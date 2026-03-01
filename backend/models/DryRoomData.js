const mongoose = require("mongoose");

// DryRoomData stores archival dry-room metrics.
// These are linked by ObjectId refs so related records can be populated later.
const dryRoomDataSchema = new mongoose.Schema({
  strainId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Strain",
    required: true,
  },
  harvestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Harvest",
    required: true,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },
  totalRacks: {
    type: Number,
    required: true,
    min: 0,
  },
  totalRacksUsed: {
    type: Number,
    required: true,
    min: 0,
  },
  strainCount: {
    type: Number,
    required: true,
    min: 0,
  },
  date: {
    type: Date,
    required: true,
  },
  timeElapsedHours: {
    type: Number,
    default: null,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("DryRoomData", dryRoomDataSchema);
