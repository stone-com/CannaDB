const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// Create a new room
router.post('/', async (req, res) => {
  try {
    const { locationId, name, type, sqFoot } = req.body;

    if (!locationId || !name || !type) {
      return res.status(400).json({ error: 'locationId, name, and type are required' });
    }

    const room = new Room({
      locationId,
      name,
      type,
      sqFoot: sqFoot || null
    });

    const savedRoom = await room.save();
    const populatedRoom = await savedRoom.populate('locationId');
    res.status(201).json(populatedRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().populate('locationId');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific room by ID
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('locationId');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
