/**
 * Company API routes.
 * Always include tenantId: req.tenantId in queries (set by requireLogin).
 */

const express = require("express");
const router = express.Router();
const Company = require("../models/Company");
const { recordAudit } = require("../utils/recordAudit");

// Company create/read endpoints.
// req.tenantId comes from requireLogin middleware — always include it in queries.

// POST /api/companies — create a company.
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const company = new Company({
      tenantId: req.tenantId,
      name: name.trim(),
    });
    const savedCompany = await company.save();
    await recordAudit(req, {
      action: "create",
      resourceType: "company",
      resourceId: savedCompany._id,
      summary: `Created company ${savedCompany.name}`,
    });
    res.status(201).json(savedCompany);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Company name must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// GET /api/companies — list all companies for this tenant.
router.get("/", async (req, res) => {
  try {
    const companies = await Company.find({ tenantId: req.tenantId });
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/companies/:id — get one company.
router.get("/:id", async (req, res) => {
  try {
    const company = await Company.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
