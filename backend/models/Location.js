const mongoose = require("mongoose");

// Physical grow site linked to a company.
const locationSchema = new mongoose.Schema({
  // Company that owns this location.
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  nickname: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

locationSchema.index({ companyId: 1, nickname: 1 }, { unique: true });
locationSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("Location", locationSchema);
