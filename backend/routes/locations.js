const express = require('express');
const router = express.Router();
const Location = require('../models/Location');

// Create a new location
router.post('/', async (req, res) => {
  try {
    const { companyId, nickname, address } = req.body;

    if (!companyId || !nickname) {
      return res.status(400).json({ error: 'companyId and nickname are required' });
    }

    const location = new Location({
      companyId,
      nickname,
      address: address || null
    });

    const savedLocation = await location.save();
    const populatedLocation = await savedLocation.populate('companyId');
    res.status(201).json(populatedLocation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all locations
router.get('/', async (req, res) => {
  try {
    const locations = await Location.find().populate('companyId');
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific location by ID
router.get('/:id', async (req, res) => {
  try {
    const location = await Location.findById(req.params.id).populate('companyId');
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
