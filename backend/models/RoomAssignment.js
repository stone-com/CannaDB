const mongoose = require("mongoose");

const roomAssignmentSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },
  assignedPlants: [
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
  active: {
    type: Boolean,
    default: true,
  },
  source: {
    type: String,
    enum: ["manual", "timer"],
    default: "manual",
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Only allow one active row for the same batch + room pair.
roomAssignmentSchema.index(
  { batchId: 1, roomId: 1, active: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
  },
);

// Speed up active lookups by room and by batch.
roomAssignmentSchema.index({ active: 1, roomId: 1, createdAt: -1 });
roomAssignmentSchema.index({ active: 1, batchId: 1, createdAt: -1 });

roomAssignmentSchema.pre("validate", function () {
  if (this.active === false && !this.endedAt) {
    this.endedAt = new Date();
  }

  if (this.active === true) {
    this.endedAt = null;
  }
});

module.exports = mongoose.model("RoomAssignment", roomAssignmentSchema);
