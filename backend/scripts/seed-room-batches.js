require("dotenv").config();
const mongoose = require("mongoose");
const Batch = require("../models/Batch");
const Strain = require("../models/Strain");
const Room = require("../models/Room");
const Location = require("../models/Location");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

const addDays = (dateValue, daysToAdd) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + daysToAdd);
  return date;
};

const getCycleStage = (cloneDate, nowDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((nowDate - new Date(cloneDate)) / msPerDay);

  if (diffDays < 0) return "future";
  if (diffDays < 14) return "clone";
  if (diffDays < 28) return "veg";
  if (diffDays < 84) return "flower";
  return "done";
};

const formatBatchNumber = (index) => `BATCH-${String(index).padStart(4, "0")}`;

const run = async () => {
  await mongoose.connect(MONGODB_URI);

  const now = new Date("2026-03-01T00:00:00.000Z");

  const locations = await Location.find({
    nickname: { $in: ["Moose Lodge", "Irongate"] },
  })
    .select("nickname")
    .lean();

  const mooseLocation = locations.find((loc) =>
    /moose\s*lodge/i.test(loc.nickname),
  );
  const irongateLocation = locations.find((loc) =>
    /irongate/i.test(loc.nickname),
  );

  if (!mooseLocation || !irongateLocation) {
    throw new Error("Missing Moose Lodge and/or Irongate location records");
  }

  const strains = await Strain.find()
    .select("_id name")
    .sort({ name: 1 })
    .lean();
  if (strains.length < 2) {
    throw new Error("Need at least 2 strains to seed batch dummy data");
  }

  const rooms = await Room.find({
    locationId: { $in: [mooseLocation._id, irongateLocation._id] },
  })
    .select("_id name type locationId")
    .lean();

  const roomPools = {
    [mooseLocation._id.toString()]: {
      clone: rooms.filter(
        (room) =>
          room.locationId.toString() === mooseLocation._id.toString() &&
          room.type === "Clone",
      ),
      veg: rooms.filter(
        (room) =>
          room.locationId.toString() === mooseLocation._id.toString() &&
          room.type === "Veg",
      ),
      flower: rooms.filter(
        (room) =>
          room.locationId.toString() === mooseLocation._id.toString() &&
          room.type === "Flower",
      ),
    },
    [irongateLocation._id.toString()]: {
      clone: rooms.filter(
        (room) =>
          room.locationId.toString() === irongateLocation._id.toString() &&
          room.type === "Clone",
      ),
      veg: rooms.filter(
        (room) =>
          room.locationId.toString() === irongateLocation._id.toString() &&
          room.type === "Veg",
      ),
      flower: rooms.filter(
        (room) =>
          room.locationId.toString() === irongateLocation._id.toString() &&
          room.type === "Flower",
      ),
    },
  };

  const hasRequiredRooms =
    roomPools[mooseLocation._id.toString()].clone.length > 0 &&
    roomPools[mooseLocation._id.toString()].veg.length > 0 &&
    roomPools[mooseLocation._id.toString()].flower.length > 0 &&
    roomPools[irongateLocation._id.toString()].clone.length > 0 &&
    roomPools[irongateLocation._id.toString()].veg.length > 0 &&
    roomPools[irongateLocation._id.toString()].flower.length > 0;

  if (!hasRequiredRooms) {
    throw new Error(
      "Need Clone, Veg, and Flower rooms at both Moose Lodge and Irongate",
    );
  }

  // Clear prior dummy batches and room assignments from this script.
  await Batch.deleteMany({ batchNumber: { $regex: /^BATCH-/ } });
  await Room.updateMany({}, { $set: { batchId: null } });

  const totalBatchesToCreate = 12;
  const firstCloneDate = new Date("2025-09-14T00:00:00.000Z");

  const createdBatches = [];

  for (let i = 0; i < totalBatchesToCreate; i += 1) {
    // Alternate location every batch creation window (every 2 weeks).
    const locationId = i % 2 === 0 ? mooseLocation._id : irongateLocation._id;

    // Pick 2 strains in a rolling pattern so data looks varied.
    const firstStrain = strains[i % strains.length];
    const secondStrain = strains[(i + 3) % strains.length];

    const cloneDate = addDays(firstCloneDate, i * 14);
    const harvestDate = addDays(cloneDate, 84);

    const batch = await Batch.create({
      batchNumber: formatBatchNumber(i + 1),
      cloneDate,
      harvestDate,
      plants: [
        {
          strainId: firstStrain._id,
          count: 80 + (i % 4) * 10,
        },
        {
          strainId: secondStrain._id,
          count: 60 + (i % 3) * 10,
        },
      ],
    });

    createdBatches.push({
      _id: batch._id,
      batchNumber: batch.batchNumber,
      cloneDate,
      harvestDate,
      locationId,
    });
  }

  // Assign only active batches (clone/veg/flower) into rooms for "current occupancy".
  const locationCounters = {
    [mooseLocation._id.toString()]: { clone: 0, veg: 0, flower: 0 },
    [irongateLocation._id.toString()]: { clone: 0, veg: 0, flower: 0 },
  };

  for (const batch of createdBatches) {
    const stage = getCycleStage(batch.cloneDate, now);

    if (!["clone", "veg", "flower"].includes(stage)) {
      continue;
    }

    const locationKey = batch.locationId.toString();
    const pool = roomPools[locationKey][stage];

    if (!pool || pool.length === 0) {
      continue;
    }

    const counter = locationCounters[locationKey][stage];
    const room = pool[counter % pool.length];
    locationCounters[locationKey][stage] += 1;

    await Room.findByIdAndUpdate(room._id, { $set: { batchId: batch._id } });
  }

  const assignedRooms = await Room.find({ batchId: { $ne: null } })
    .populate("locationId", "nickname")
    .populate("batchId", "batchNumber cloneDate harvestDate")
    .select("name type locationId batchId")
    .lean();

  console.log("BATCHES_CREATED", createdBatches.length);
  console.log("ROOMS_WITH_BATCH", assignedRooms.length);
  console.log(
    "ROOM_ASSIGNMENTS",
    JSON.stringify(
      assignedRooms.map((room) => ({
        location: room.locationId?.nickname,
        room: room.name,
        roomType: room.type,
        batchNumber: room.batchId?.batchNumber,
        cloneDate: room.batchId?.cloneDate,
        harvestDate: room.batchId?.harvestDate,
      })),
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
