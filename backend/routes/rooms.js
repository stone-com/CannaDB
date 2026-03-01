const express = require("express");
const router = express.Router();
const Room = require("../models/Room");

// Room CRUD endpoints.
// Each handler returns JSON so the frontend can consume API responses directly.

// Create a new room
router.post("/", async (req, res) => {
  try {
    const { locationId, name, type, sqFoot, batchId } = req.body;

    if (!locationId || !name || !type) {
      return res
        .status(400)
        .json({ error: "locationId, name, and type are required" });
    }

    const room = new Room({
      locationId,
      name,
      type,
      sqFoot: sqFoot || null,
      batchId: batchId || null,
    });

    const savedRoom = await room.save();
    const populatedRoom = await savedRoom.populate([
      "locationId",
      "batchId",
      "batchId.plants.strainId",
    ]);
    res.status(201).json(populatedRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Return all rooms with location details.
router.get("/", async (req, res) => {
  try {
    const rooms = await Room.find().populate([
      "locationId",
      "batchId",
      "batchId.plants.strainId",
    ]);
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Return one room by ID with location details.
router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate([
      "locationId",
      "batchId",
      "batchId.plants.strainId",
    ]);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update room fields (including assigning/changing batchId).
router.patch("/:id", async (req, res) => {
  try {
    const { name, type, sqFoot, batchId } = req.body;

    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (name !== undefined) room.name = name;
    if (type !== undefined) room.type = type;
    if (sqFoot !== undefined) room.sqFoot = sqFoot;
    if (batchId !== undefined) room.batchId = batchId;

    const updatedRoom = await room.save();
    const populatedRoom = await updatedRoom.populate([
      "locationId",
      "batchId",
      "batchId.plants.strainId",
    ]);

    res.json(populatedRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
