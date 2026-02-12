const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');

// Create a new batch
router.post('/', async (req, res) => {
  try {
    const { batchNumber, harvestId, cloneDate, harvestDate, plants } = req.body;

    if (!batchNumber || !cloneDate) {
      return res.status(400).json({ error: 'batchNumber and cloneDate are required' });
    }

    const batch = new Batch({
      batchNumber,
      harvestId: harvestId || null,
      cloneDate,
      harvestDate: harvestDate || null,
      plants: plants || []
    });

    const savedBatch = await batch.save();
    const populatedBatch = await savedBatch.populate(['harvestId', 'plants.strainId']);
    res.status(201).json(populatedBatch);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Batch number must be unique' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all batches
router.get('/', async (req, res) => {
  try {
    const batches = await Batch.find().populate(['harvestId', 'plants.strainId']);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific batch by ID
router.get('/:id', async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id).populate(['harvestId', 'plants.strainId']);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
