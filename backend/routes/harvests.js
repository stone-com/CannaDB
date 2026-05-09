const express = require("express");
const router = express.Router();
const Harvest = require("../models/Harvest");
const Batch = require("../models/Batch");
const Room = require("../models/Room");

// Harvest CRUD endpoints.
// Note: rooms + strains are nested in this schema, so populate uses nested paths.

// Create a new harvest
router.post("/", async (req, res) => {
  try {
    const { batchId, locationId, harvestNumber, rooms, harvestDate } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: "batchId is required" });
    }

    // Create a Harvest document instance.
    const harvest = new Harvest({
      batchId,
      locationId,
      harvestNumber,
      rooms: rooms || [],
      harvestDate: harvestDate || Date.now(),
    });

    const savedHarvest = await harvest.save();

    await Batch.findByIdAndUpdate(batchId, {
      harvestId: savedHarvest._id,
      lifecycleStage: "Drying",
      stageStartedAt: new Date(),
      nextTransitionAt: null,
    });

    await Room.updateMany({ batchId }, { $set: { batchId: null } });

    // Nested populate path syntax:
    // 'rooms.strains.strainId' means each room item -> each strain item -> strainId ref.
    const populatedHarvest = await savedHarvest.populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    res.status(201).json(populatedHarvest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Return all harvest records with populated relations.
router.get("/", async (req, res) => {
  try {
    const harvests = await Harvest.find().populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    res.json(harvests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Return one harvest record by ID.
router.get("/:id", async (req, res) => {
  try {
    const harvest = await Harvest.findById(req.params.id).populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    if (!harvest) {
      return res.status(404).json({ error: "Harvest not found" });
    }
    res.json(harvest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Partially update a harvest.
// PATCH updates only fields sent by the client (unlike PUT, which typically replaces all).
router.patch("/:id", async (req, res) => {
  try {
    const { locationId, harvestNumber, rooms, harvestDate } = req.body;

    const harvest = await Harvest.findById(req.params.id);
    if (!harvest) {
      return res.status(404).json({ error: "Harvest not found" });
    }

    // Only overwrite fields included in the request body.
    if (locationId !== undefined) harvest.locationId = locationId;
    if (harvestNumber !== undefined) harvest.harvestNumber = harvestNumber;
    if (rooms !== undefined) harvest.rooms = rooms;
    if (harvestDate !== undefined) harvest.harvestDate = harvestDate;

    const updatedHarvest = await harvest.save();

    await Batch.findByIdAndUpdate(harvest.batchId, {
      lifecycleStage: "Completed",
      stageStartedAt: new Date(),
      nextTransitionAt: null,
    });

    const populatedHarvest = await updatedHarvest.populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    res.json(populatedHarvest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
