const express = require('express');
const router = express.Router();
const Lot = require('../models/Lot');

// Create a new lot
router.post('/', async (req, res) => {
  try {
    const { strainIds } = req.body;

    if (!strainIds || !Array.isArray(strainIds) || strainIds.length === 0) {
      return res.status(400).json({ error: 'Lot must include at least one strain ID' });
    }

    const lot = new Lot({
      strainIds
    });

    const savedLot = await lot.save();
    const populatedLot = await savedLot.populate('strainIds');
    res.status(201).json(populatedLot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all lots
router.get('/', async (req, res) => {
  try {
    const lots = await Lot.find().populate('strainIds');
    res.json(lots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific lot by ID
router.get('/:id', async (req, res) => {
  try {
    const lot = await Lot.findById(req.params.id).populate('strainIds');
    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' });
    }
    res.json(lot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
