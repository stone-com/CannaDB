/**
 * Saves a row to the activity log after something is created, updated, or deleted.
 */

const AuditLog = require("../models/AuditLog");

// Writes one audit log row. Skips quietly if data is missing or the write fails.
async function recordAudit(req, entry) {
  if (!req?.tenantId || !req?.user?._id) return;

  const { action, resourceType, resourceId, batchId, summary } = entry;

  if (!action || !resourceType || !resourceId || !summary) return;

  try {
    await AuditLog.create({
      tenantId: req.tenantId,
      userId: req.user._id,
      action,
      resourceType,
      resourceId,
      batchId: batchId || null,
      summary: String(summary).trim(),
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

module.exports = { recordAudit };
