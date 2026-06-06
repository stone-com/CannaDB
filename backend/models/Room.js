const mongoose = require("mongoose");

// A room inside a location (Flower, Veg, Drying, etc.).
const roomSchema = new mongoose.Schema({
  // Parent location for this room.
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      "Flower",
      "Veg",
      "Mom",
      "Clone",
      "Culture",
      "Inventory",
      "Packaging",
      "Storage",
      "Drying",
    ],
    required: true,
  },
  sqFoot: {
    type: Number,
    default: null,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

roomSchema.index({ locationId: 1, name: 1 }, { unique: true });
roomSchema.index({ locationId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Room", roomSchema);
