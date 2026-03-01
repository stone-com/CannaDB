const mongoose = require("mongoose");

// Room = a specific area inside a location (Flower, Veg, Drying, etc.).
const roomSchema = new mongoose.Schema({
  // ObjectId reference to Location collection.
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
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Room", roomSchema);
