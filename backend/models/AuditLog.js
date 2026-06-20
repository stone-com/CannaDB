const mongoose = require("mongoose");

// Append-only record of create, update, and delete actions within a tenant.
const auditLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    enum: ["create", "update", "delete"],
    required: true,
  },
  resourceType: {
    type: String,
    required: true,
    trim: true,
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  // Set when the change affects or relates to a specific batch.
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    default: null,
  },
  summary: {
    type: String,
    required: true,
    trim: true,
  },
  occurredAt: {
    type: Date,
    default: Date.now,
  },
});

auditLogSchema.index({ tenantId: 1, occurredAt: -1 });
auditLogSchema.index({ tenantId: 1, resourceType: 1, resourceId: 1 });
auditLogSchema.index({ tenantId: 1, batchId: 1, occurredAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
