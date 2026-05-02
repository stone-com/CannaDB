const mongoose = require("mongoose");

// Batch = one production unit tracked over time.
const batchSchema = new mongoose.Schema({
  batchNumber: {
    type: String,
    required: true,
    unique: true,
  },
  // Optional link to a Harvest document once the batch is harvested.
  harvestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Harvest",
    default: null,
  },
  cloneDate: {
    type: Date,
    required: true,
  },
  harvestDate: {
    type: Date,
    default: null,
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    default: null,
  },
  // Each entry tracks one room this batch occupies plus the plants in that room.
  // A batch can span multiple rooms (e.g. two flower rooms, a mom room, etc.).
  rooms: [
    {
      roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true,
      },
      plants: [
        {
          strainId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Strain",
            required: true,
          },
          count: {
            type: Number,
            required: true,
            default: 0,
          },
        },
      ],
    },
  ],
  lifecycleStage: {
    type: String,
    enum: ["Clone", "Veg", "Flower", "HarvestReady", "Drying", "Completed"],
    default: "Clone",
  },
  stageStartedAt: {
    type: Date,
    default: null,
  },
  nextTransitionAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Batch", batchSchema);
