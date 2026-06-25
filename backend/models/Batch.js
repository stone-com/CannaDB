const mongoose = require("mongoose");

// A batch is one tracked plant group over time.
const batchSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  batchNumber: {
    type: String,
    required: true,
  },
  // Set after harvest is created.
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
  batchType: {
    type: String,
    enum: ["production", "mom"],
    default: "production",
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    default: null,
  },
  // Total plants in this batch by strain. Room placement lives in RoomAssignment.
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
        min: 0,
      },
    },
  ],
  lifecycleStage: {
    type: String,
    enum: [
      "Clone",
      "Veg",
      "Flower",
      "Mom",
      "HarvestReady",
      "Drying",
      "Completed",
    ],
    default: "Clone",
  },
  stageStartedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

batchSchema.index({ tenantId: 1, batchNumber: 1 }, { unique: true });
batchSchema.index({ tenantId: 1, lifecycleStage: 1, batchType: 1, harvestDate: 1 });
batchSchema.index({ tenantId: 1, location: 1, lifecycleStage: 1, createdAt: -1 });
batchSchema.index({ tenantId: 1, "plants.strainId": 1 });

module.exports = mongoose.model("Batch", batchSchema);
