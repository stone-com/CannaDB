const mongoose = require("mongoose");

// Location = physical site linked to a company.
const locationSchema = new mongoose.Schema({
  // ObjectId reference to Company collection.
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

module.exports = mongoose.model("Location", locationSchema);
