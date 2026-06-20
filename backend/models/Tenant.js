const mongoose = require("mongoose");

// SaaS tenant — the organization that subscribes to the platform.
const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["active", "suspended"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Tenant", tenantSchema);
