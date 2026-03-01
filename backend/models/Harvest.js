const mongoose = require("mongoose");
const { applyHarvestCalculations } = require("../utils/harvestCalculations");
const Room = require("./Room");

// This schema stores a single harvest "record".
// Think of it as: one batch + one or more rooms + strain metrics for each room.
const harvestSchema = new mongoose.Schema({
  // Human-readable unique harvest number for operations/reporting.
  harvestNumber: {
    type: String,
    required: true,
    unique: true,
    sparse: true,
    trim: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  // Direct link to the location where this harvest happened.
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    required: true,
  },
  // `rooms` is an array because a harvest can span multiple rooms.
  // Each room entry can also hold room-specific strain metrics.
  rooms: [
    {
      roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true,
      },
      strains: [
        // This nested object stores metrics for one strain inside one room.
        {
          strainId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Strain",
            required: true,
          },
          plantCount: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
          },
          totes: [
            {
              // Each tote entry only stores wet weight.
              // Dry totals are stored separately at strain level.
              wetWeight: {
                type: Number,
                required: true,
                min: 0,
              },
            },
          ],
          totalWetWeightGrams: {
            type: Number,
            default: 0,
            min: 0,
          },
          totalDryWeightGrams: {
            type: Number,
            default: 0,
            min: 0,
          },
          wetPlantAvgWeightGrams: {
            type: Number,
            default: null,
          },
          dryPlantAvgWeightGrams: {
            type: Number,
            default: null,
          },
          percentChangeWetToDry: {
            type: Number,
            default: null,
          },
          // Justin's formula result for this strain.
          yieldGramsPerSquareFoot: {
            type: Number,
            default: null,
          },
        },
      ],
    },
  ],

  // Rollups across every room + strain entry above.
  totalPlantCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalWetWeightGrams: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalDryWeightGrams: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalPercentChangeWetToDry: {
    type: Number,
    default: null,
  },
  totalYieldGramsPerSquareFoot: {
    type: Number,
    default: null,
  },
  harvestDate: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Mongoose hook: runs before validation on .save().
// We use it so derived fields always stay in sync with the raw inputs.
harvestSchema.pre("validate", async function () {
  // `this` is the current document instance being saved.
  // If locationId was not explicitly provided, try to derive it from the first room.
  if (!this.locationId) {
    const firstRoomId = Array.isArray(this.rooms)
      ? this.rooms[0]?.roomId
      : undefined;

    if (firstRoomId) {
      const roomDoc = await Room.findById(firstRoomId).select("locationId");
      if (roomDoc?.locationId) {
        this.locationId = roomDoc.locationId;
      }
    }
  }

  await applyHarvestCalculations(this);
});

module.exports = mongoose.model("Harvest", harvestSchema);
