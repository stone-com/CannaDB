const express = require('express');
const router = express.Router();
const Harvest = require('../models/Harvest');

// Create a new harvest
router.post('/', async (req, res) => {
  try {
    const { batchId, room, strains, harvestDate } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: 'batchId is required' });
    }

    const harvest = new Harvest({
      batchId,
      room: room || [],
      strains: strains || [],
      harvestDate: harvestDate || Date.now()
    });

    const savedHarvest = await harvest.save();
    const populatedHarvest = await savedHarvest.populate(['batchId', 'room', 'strains.strainId']);
    res.status(201).json(populatedHarvest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all harvests
router.get('/', async (req, res) => {
  try {
    const harvests = await Harvest.find().populate(['batchId', 'room', 'strains.strainId']);
    res.json(harvests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific harvest by ID
router.get('/:id', async (req, res) => {
  try {
    const harvest = await Harvest.findById(req.params.id).populate(['batchId', 'room', 'strains.strainId']);
    if (!harvest) {
      return res.status(404).json({ error: 'Harvest not found' });
    }
    res.json(harvest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a harvest (add/update totes, strains, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const { room, strains, harvestDate } = req.body;
    
    const harvest = await Harvest.findById(req.params.id);
    if (!harvest) {
      return res.status(404).json({ error: 'Harvest not found' });
    }

    // Update fields if provided
    if (room !== undefined) harvest.room = room;
    if (strains !== undefined) harvest.strains = strains;
    if (harvestDate !== undefined) harvest.harvestDate = harvestDate;

    const updatedHarvest = await harvest.save();
    const populatedHarvest = await updatedHarvest.populate(['batchId', 'room', 'strains.strainId']);
    res.json(populatedHarvest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
