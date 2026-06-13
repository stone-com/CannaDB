const mongoose = require("mongoose");

// Top-level company record.
const companySchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // Auto-set when document is created.
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

companySchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Company", companySchema);
