const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const RoomAssignment = require("../models/RoomAssignment");

// Populate the room's parent location so the frontend gets readable location data.
const ROOM_POPULATE = ["locationId"];

// Room create/read/update endpoints.

// Create room.
router.post("/", async (req, res) => {
  try {
    const { locationId, name, type, sqFoot } = req.body;

    if (!locationId || !name || !type) {
      return res
        .status(400)
        .json({ error: "locationId, name, and type are required" });
    }

    // Create the room document from the form data.
    const room = new Room({
      locationId,
      name,
      type,
      sqFoot: sqFoot || null,
    });

    // Save first, then populate location details for the response.
    const savedRoom = await room.save();
    const populatedRoom = await savedRoom.populate(ROOM_POPULATE);
    res.status(201).json(populatedRoom);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "A room with this name already exists at that location",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// List rooms.
router.get("/", async (req, res) => {
  try {
    // Return every room with its related location information.
    const rooms = await Room.find().populate(ROOM_POPULATE);
    res.json(rooms);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "A room with this name already exists at that location",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// Get one room.
router.get("/:id", async (req, res) => {
  try {
    // Return one room and include its location details.
    const room = await Room.findById(req.params.id).populate(ROOM_POPULATE);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update room fields.
router.patch("/:id", async (req, res) => {
  try {
    const { locationId, name, type, sqFoot } = req.body;

    // Load the room first so we can update only the fields the client sent.
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (locationId !== undefined) room.locationId = locationId;
    if (name !== undefined) room.name = name;
    if (type !== undefined) room.type = type;
    if (sqFoot !== undefined) room.sqFoot = sqFoot;

    // Save the updated room, then populate location details for the response.
    const updatedRoom = await room.save();
    const populatedRoom = await updatedRoom.populate(ROOM_POPULATE);

    res.json(populatedRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete room when no batch/assignment/harvest references exist.
router.delete("/:id", async (req, res) => {
  try {
    const roomId = req.params.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const [batchRef, assignmentRef, harvestRef] = await Promise.all([
      Batch.exists({ "rooms.roomId": roomId }),
      RoomAssignment.exists({ roomId }),
      Harvest.exists({ "rooms.roomId": roomId }),
    ]);

    if (batchRef || assignmentRef || harvestRef) {
      return res.status(409).json({
        error:
          "Cannot delete room because it is referenced by one or more batches, room assignments, or harvests",
      });
    }

    await Room.findByIdAndDelete(roomId);
    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "A room with this name already exists at that location",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
