/**
 * Location API routes.
 * Always include tenantId: req.tenantId in queries (set by requireLogin).
 */

const express = require("express");
const router = express.Router();
const Company = require("../models/Company");
const Location = require("../models/Location");
const { recordAudit } = require("../utils/recordAudit");

// POST /api/locations — create a grow location.
router.post("/", async (req, res) => {
  try {
    const { companyId, nickname, address } = req.body;

    if (!companyId || !nickname) {
      return res
        .status(400)
        .json({ error: "companyId and nickname are required" });
    }

    const company = await Company.findOne({
      tenantId: req.tenantId,
      _id: companyId,
    });

    if (!company) {
      return res.status(400).json({ error: "Invalid company for this tenant" });
    }

    const location = new Location({
      tenantId: req.tenantId,
      companyId,
      nickname,
      address: address || null,
    });

    const savedLocation = await location.save();
    const populatedLocation = await savedLocation.populate("companyId");
    await recordAudit(req, {
      action: "create",
      resourceType: "location",
      resourceId: savedLocation._id,
      summary: `Created location ${savedLocation.nickname}`,
    });
    res.status(201).json(populatedLocation);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "A location with this nickname already exists for that company",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// GET /api/locations — list all locations.
router.get("/", async (req, res) => {
  try {
    const locations = await Location.find({ tenantId: req.tenantId }).populate(
      "companyId",
    );
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/locations/:id — get one location.
router.get("/:id", async (req, res) => {
  try {
    const location = await Location.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate("companyId");

    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/locations/:id — update a location.
router.put("/:id", async (req, res) => {
  try {
    const { companyId, nickname, address } = req.body;

    if (!companyId || !nickname) {
      return res
        .status(400)
        .json({ error: "companyId and nickname are required" });
    }

    const company = await Company.findOne({
      tenantId: req.tenantId,
      _id: companyId,
    });

    if (!company) {
      return res.status(400).json({ error: "Invalid company for this tenant" });
    }

    const updatedLocation = await Location.findOneAndUpdate(
      { tenantId: req.tenantId, _id: req.params.id },
      {
        companyId,
        nickname,
        address: address || null,
      },
      {
        new: true,
        runValidators: true,
      },
    ).populate("companyId");

    if (!updatedLocation) {
      return res.status(404).json({ error: "Location not found" });
    }

    await recordAudit(req, {
      action: "update",
      resourceType: "location",
      resourceId: updatedLocation._id,
      summary: `Updated location ${updatedLocation.nickname}`,
    });

    res.json(updatedLocation);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "A location with this nickname already exists for that company",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
