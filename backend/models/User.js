const mongoose = require("mongoose");

// User account scoped to a single tenant.
const userSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    trim: true,
    default: "",
  },
  role: {
    type: String,
    enum: ["owner", "admin", "operator", "viewer"],
    default: "operator",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
