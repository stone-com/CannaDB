const mongoose = require("mongoose");
const { applyHarvestCalculations } = require("../utils/harvestCalculations");
const Room = require("./Room");

// One harvest record: batch + rooms + per-strain metrics.
const harvestSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  // Human-friendly unique ID for this harvest.
  harvestNumber: {
    type: String,
    required: true,
    trim: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  // Location where the harvest was done.
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    required: true,
  },
  // A harvest can include multiple rooms.
  rooms: [
    {
      roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true,
      },
      strains: [
        // Metrics for one strain in one room.
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
              // Tote entries store wet weight only.
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
          // Yield score from the harvest formula.
          yieldGramsPerSquareFoot: {
            type: Number,
            default: null,
          },
        },
      ],
    },
  ],

  // Totals across all rooms and strains.
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

harvestSchema.index({ tenantId: 1, harvestNumber: 1 }, { unique: true });
harvestSchema.index({ tenantId: 1, batchId: 1 }, { unique: true });
harvestSchema.index({ tenantId: 1, harvestDate: -1, createdAt: -1 });
harvestSchema.index({ tenantId: 1, locationId: 1, harvestDate: -1 });

// Recompute derived fields before validation/save.
harvestSchema.pre("validate", async function () {
  // Fill location from first room if client did not send locationId.
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
