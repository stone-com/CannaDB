const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const logs = await AuditLog.find({ tenantId: req.tenantId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .populate("userId", "name email");

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
