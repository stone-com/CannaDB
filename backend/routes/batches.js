const express = require("express");
const router = express.Router();
const Batch = require("../models/Batch");

// Batch CRUD endpoints.
// `populate(...)` replaces ObjectId refs with actual referenced documents.

// Create a new batch
router.post("/", async (req, res) => {
  try {
    const { batchNumber, harvestId, cloneDate, harvestDate, plants } = req.body;

    if (!batchNumber || !cloneDate) {
      return res
        .status(400)
        .json({ error: "batchNumber and cloneDate are required" });
    }

    // Build a new batch document from the request body.
    const batch = new Batch({
      batchNumber,
      harvestId: harvestId || null,
      cloneDate,
      harvestDate: harvestDate || null,
      plants: plants || [],
    });

    const savedBatch = await batch.save();
    // Populate linked docs so frontend gets readable related data.
    const populatedBatch = await savedBatch.populate([
      "harvestId",
      "plants.strainId",
    ]);
    res.status(201).json(populatedBatch);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Batch number must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Return all batches with populated relations.
router.get("/", async (req, res) => {
  try {
    const batches = await Batch.find().populate([
      "harvestId",
      "plants.strainId",
    ]);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Return one batch by ID with populated relations.
router.get("/:id", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id).populate([
      "harvestId",
      "plants.strainId",
    ]);
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
