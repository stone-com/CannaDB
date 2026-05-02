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
  // Nested array where each item stores one strain + plant count.
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
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    default: null,
  },
  // Array of room _ids this batch is currently in.
  // Each entry is an ObjectId that references a Room document.
  // Using an array because a batch can occupy multiple rooms at once.
  rooms: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Batch", batchSchema);
