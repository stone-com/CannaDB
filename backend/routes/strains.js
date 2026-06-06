const express = require("express");
const router = express.Router();
const Strain = require("../models/Strain");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const RoomAssignment = require("../models/RoomAssignment");

// Strain create/read endpoints.

// Create strain.
router.post("/", async (req, res) => {
  try {
    const { name, type, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Strain name is required" });
    }

    const strain = new Strain({
      name,
      type: type || null,
      status: status || null,
    });

    const savedStrain = await strain.save();
    res.status(201).json(savedStrain);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Strain name must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// List strains.
router.get("/", async (req, res) => {
  try {
    const strains = await Strain.find();
    res.json(strains);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one strain.
router.get("/:id", async (req, res) => {
  try {
    const strain = await Strain.findById(req.params.id);
    if (!strain) {
      return res.status(404).json({ error: "Strain not found" });
    }
    res.json(strain);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update one strain.
router.patch("/:id", async (req, res) => {
  try {
    const { name, type, status } = req.body;

    const strain = await Strain.findById(req.params.id);
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
    res.json(updatedStrain);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Strain name must be unique" });
    }

    res.status(500).json({ error: error.message });
  }
});

// Delete one strain (only when not referenced by room plans, assignments, or harvests).
router.delete("/:id", async (req, res) => {
  try {
    const strainId = req.params.id;

    const strain = await Strain.findById(strainId);
    if (!strain) {
      return res.status(404).json({ error: "Strain not found" });
    }

    const [batchRef, assignmentRef, harvestRef] = await Promise.all([
      Batch.exists({ "rooms.plants.strainId": strainId }),
      RoomAssignment.exists({ "assignedPlants.strainId": strainId }),
      Harvest.exists({ "rooms.strains.strainId": strainId }),
    ]);

    if (batchRef || assignmentRef || harvestRef) {
      return res.status(409).json({
        error:
          "Cannot delete strain because it is referenced by one or more batches, room assignments, or harvests",
      });
    }

    await Strain.findByIdAndDelete(strainId);
    res.json({ message: "Strain deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
