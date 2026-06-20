const express = require("express");
const router = express.Router();
const Room = require("../models/Room");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const RoomAssignment = require("../models/RoomAssignment");
const Location = require("../models/Location");
const { recordAudit } = require("../utils/recordAudit");

const ROOM_POPULATE = ["locationId"];

router.post("/", async (req, res) => {
  try {
    const { locationId, name, type, sqFoot } = req.body;

    if (!locationId || !name || !type) {
      return res
        .status(400)
        .json({ error: "locationId, name, and type are required" });
    }

    const location = await Location.findOne({
      tenantId: req.tenantId,
      _id: locationId,
    });

    if (!location) {
      return res.status(400).json({ error: "Invalid location for this tenant" });
    }

    const room = new Room({
      tenantId: req.tenantId,
      locationId,
      name,
      type,
      sqFoot: sqFoot || null,
    });

    const savedRoom = await room.save();
    const populatedRoom = await savedRoom.populate(ROOM_POPULATE);
    await recordAudit(req, {
      action: "create",
      resourceType: "room",
      resourceId: savedRoom._id,
      summary: `Created room ${savedRoom.name} (${savedRoom.type})`,
    });
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

router.get("/", async (req, res) => {
  try {
    const rooms = await Room.find({ tenantId: req.tenantId }).populate(
      ROOM_POPULATE,
    );
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate(ROOM_POPULATE);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { locationId, name, type, sqFoot } = req.body;

    const room = await Room.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (locationId !== undefined) {
      const location = await Location.findOne({
        tenantId: req.tenantId,
        _id: locationId,
      });

      if (!location) {
        return res.status(400).json({ error: "Invalid location for this tenant" });
      }

      room.locationId = locationId;
    }

    if (name !== undefined) room.name = name;
    if (type !== undefined) room.type = type;
    if (sqFoot !== undefined) room.sqFoot = sqFoot;

    const updatedRoom = await room.save();
    const populatedRoom = await updatedRoom.populate(ROOM_POPULATE);

    await recordAudit(req, {
      action: "update",
      resourceType: "room",
      resourceId: updatedRoom._id,
      summary: `Updated room ${updatedRoom.name}`,
    });

    res.json(populatedRoom);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const roomId = req.params.id;

    const room = await Room.findOne({
      tenantId: req.tenantId,
      _id: roomId,
    });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const [batchRef, assignmentRef, harvestRef] = await Promise.all([
      Batch.exists({ tenantId: req.tenantId, "rooms.roomId": roomId }),
      RoomAssignment.exists({ tenantId: req.tenantId, roomId }),
      Harvest.exists({ tenantId: req.tenantId, "rooms.roomId": roomId }),
    ]);

    if (batchRef || assignmentRef || harvestRef) {
      return res.status(409).json({
        error:
          "Cannot delete room because it is referenced by one or more batches, room assignments, or harvests",
      });
    }

    await Room.findOneAndDelete({ tenantId: req.tenantId, _id: roomId });
    await recordAudit(req, {
      action: "delete",
      resourceType: "room",
      resourceId: roomId,
      summary: `Deleted room ${room.name}`,
    });
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
