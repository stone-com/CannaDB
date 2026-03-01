const mongoose = require("mongoose");

// Strain = reusable genetics record used by batches and harvests.
const strainSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["indica", "sativa", "hybrid", "CBD"],
    default: null,
  },
  // Current lifecycle state for this strain.
  status: {
    type: String,
    enum: ["production", "bench", "pheno"],
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Strain", strainSchema);
