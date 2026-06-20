/**
 * Strain API routes.
 * Rule: every database query must include tenantId: req.tenantId.
 * req.tenantId is set automatically by requireLogin before this code runs.
 */

const express = require("express");
const router = express.Router();
const Strain = require("../models/Strain");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const RoomAssignment = require("../models/RoomAssignment");
const { recordAudit } = require("../utils/recordAudit");

// POST /api/strains — create a new strain.
router.post("/", async (req, res) => {
  try {
    const { name, type, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Strain name is required" });
    }

    const strain = new Strain({
      tenantId: req.tenantId,
      name: name.trim(),
      type: type || null,
      status: status || null,
    });

    const savedStrain = await strain.save();
    await recordAudit(req, {
      action: "create",
      resourceType: "strain",
      resourceId: savedStrain._id,
      summary: `Created strain ${savedStrain.name}`,
    });
    res.status(201).json(savedStrain);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Strain name must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get("/", async (req, res) => {
  try {
    const strains = await Strain.find({ tenantId: req.tenantId });
    res.json(strains);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const strain = await Strain.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    });

    if (!strain) {
      return res.status(404).json({ error: "Strain not found" });
    }

    res.json(strain);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { name, type, status } = req.body;

    const strain = await Strain.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    });

    if (!strain) {
      return res.status(404).json({ error: "Strain not found" });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: "Strain name is required" });
      }
      strain.name = String(name).trim();
    }

    if (type !== undefined) {
      strain.type = type || null;
    }

    if (status !== undefined) {
      strain.status = status || null;
    }

    const updatedStrain = await strain.save();
    await recordAudit(req, {
      action: "update",
      resourceType: "strain",
      resourceId: updatedStrain._id,
      summary: `Updated strain ${updatedStrain.name}`,
    });
    res.json(updatedStrain);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Strain name must be unique" });
    }

    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const strainId = req.params.id;

    const strain = await Strain.findOne({
      tenantId: req.tenantId,
      _id: strainId,
    });

    if (!strain) {
      return res.status(404).json({ error: "Strain not found" });
    }

    const [batchRef, assignmentRef, harvestRef] = await Promise.all([
      Batch.exists({
        tenantId: req.tenantId,
        "rooms.plants.strainId": strainId,
      }),
      RoomAssignment.exists({
        tenantId: req.tenantId,
        "assignedPlants.strainId": strainId,
      }),
      Harvest.exists({
        tenantId: req.tenantId,
        "rooms.strains.strainId": strainId,
      }),
    ]);

    if (batchRef || assignmentRef || harvestRef) {
      return res.status(409).json({
        error:
          "Cannot delete strain because it is referenced by one or more batches, room assignments, or harvests",
      });
    }

    await Strain.findOneAndDelete({
      tenantId: req.tenantId,
      _id: strainId,
    });
    await recordAudit(req, {
      action: "delete",
      resourceType: "strain",
      resourceId: strainId,
      summary: `Deleted strain ${strain.name}`,
    });
    res.json({ message: "Strain deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
