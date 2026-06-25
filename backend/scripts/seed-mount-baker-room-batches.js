/**
 * Adds one active batch per room that currently has no assignment
 * for the Mount Baker demo tenant (admin@demo.local).
 *
 * Usage:
 *   node scripts/seed-mount-baker-room-batches.js
 */

require("dotenv").config();

const mongoose = require("mongoose");

const User = require("../models/User");
const Location = require("../models/Location");
const Room = require("../models/Room");
const Strain = require("../models/Strain");
const Batch = require("../models/Batch");
const RoomAssignment = require("../models/RoomAssignment");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || "admin@demo.local";

const CLONE_DAYS = 14;
const VEG_DAYS = 14;
const FLOWER_DAYS = 7;
const CYCLE_DAYS = CLONE_DAYS + VEG_DAYS + FLOWER_DAYS;

const STAGE_BY_ROOM_TYPE = {
  Clone: "Clone",
  Veg: "Veg",
  Flower: "Flower",
  Mom: "Mom",
  Drying: "Drying",
};

const LOCATION_PREFIX = {
  "Moose Lodge": "ML",
  "Iron Gate": "IG",
};

function atHour(date, hour = 10) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getNextFriday(date) {
  const d = atHour(date);
  const day = d.getDay();
  if (day === 5) return addDays(d, 7);
  return addDays(d, (5 - day + 7) % 7);
}

function seededInt(min, max, seed) {
  const span = max - min + 1;
  return min + (Math.abs(seed * 9301 + 49297) % span);
}

function pickStrains(strains, seed, count) {
  const pool = [...strains].sort((a, b) => {
    const aKey = (seed + String(a.name).length * 17) % 101;
    const bKey = (seed + String(b.name).length * 23 + 7) % 101;
    return aKey - bKey;
  });

  return pool.slice(0, Math.min(count, pool.length));
}

function buildPlantMix(strains, seed, strainCount, totalPlants) {
  const selected = pickStrains(strains, seed, strainCount);
  if (selected.length === 0) return [];

  const mix = [];
  let remaining = totalPlants;

  for (let i = 0; i < selected.length - 1; i += 1) {
    const share = Math.max(8, Math.round(remaining / (selected.length - i)));
    const count = Math.min(share, remaining - (selected.length - i - 1) * 8);
    mix.push({ strainId: selected[i]._id, count });
    remaining -= count;
  }

  mix.push({
    strainId: selected[selected.length - 1]._id,
    count: Math.max(8, remaining),
  });

  return mix;
}

function parseBatchCounter(batchNumber, prefix) {
  const match = String(batchNumber || "").match(
    new RegExp(`^${prefix}-(\\d+)$`),
  );
  return match ? Number(match[1]) : 0;
}

async function nextBatchNumber(tenantId, prefix) {
  const batches = await Batch.find({
    tenantId,
    batchNumber: new RegExp(`^${prefix}-\\d+$`),
  })
    .select("batchNumber")
    .lean();

  const maxCounter = batches.reduce(
    (max, batch) => Math.max(max, parseBatchCounter(batch.batchNumber, prefix)),
    0,
  );

  return `${prefix}-${String(maxCounter + 1).padStart(3, "0")}`;
}

function buildBatchDates(roomType, seed) {
  const today = atHour(new Date());
  const nextHarvestFriday = getNextFriday(today);

  if (roomType === "Drying") {
    const harvestDate = addDays(today, -(3 + (seed % 4)));
    return {
      cloneDate: addDays(harvestDate, -CYCLE_DAYS),
      harvestDate,
      stageStartedAt: harvestDate,
    };
  }

  if (roomType === "Flower") {
    const harvestDate = addDays(nextHarvestFriday, (seed % 3) * 7);
    return {
      cloneDate: addDays(harvestDate, -CYCLE_DAYS),
      harvestDate,
      stageStartedAt: addDays(harvestDate, -FLOWER_DAYS),
    };
  }

  if (roomType === "Veg") {
    const harvestDate = addDays(nextHarvestFriday, 7 + (seed % 2) * 7);
    return {
      cloneDate: addDays(harvestDate, -CYCLE_DAYS),
      harvestDate,
      stageStartedAt: addDays(harvestDate, -(VEG_DAYS + FLOWER_DAYS)),
    };
  }

  if (roomType === "Clone") {
    const harvestDate = addDays(nextHarvestFriday, 14 + (seed % 3) * 7);
    const cloneDate = addDays(harvestDate, -CYCLE_DAYS);
    return {
      cloneDate,
      harvestDate,
      stageStartedAt: cloneDate,
    };
  }

  const cloneDate = addDays(today, -(90 + seed * 11));
  return {
    cloneDate,
    harvestDate: null,
    stageStartedAt: addDays(cloneDate, 42),
  };
}

function plantTotalsForRoomType(roomType, seed) {
  if (roomType === "Mom") {
    return { strainCount: 1, totalPlants: 16 + (seed % 4) * 4 };
  }

  if (roomType === "Drying") {
    return { strainCount: 2 + (seed % 2), totalPlants: 90 + (seed % 5) * 12 };
  }

  if (roomType === "Clone") {
    return { strainCount: 3 + (seed % 2), totalPlants: 130 + (seed % 4) * 10 };
  }

  return { strainCount: 3 + (seed % 3), totalPlants: 150 + (seed % 6) * 8 };
}

async function main() {
  console.log("Seed Mount Baker room batches");
  console.log(`Database: ${MONGODB_URI}\n`);

  await mongoose.connect(MONGODB_URI);

  const user = await User.findOne({ email: DEMO_EMAIL.toLowerCase() });
  if (!user) {
    throw new Error(`Demo user not found (${DEMO_EMAIL})`);
  }

  const tenantId = user.tenantId;
  const [locations, rooms, strains, activeAssignments] = await Promise.all([
    Location.find({ tenantId }).lean(),
    Room.find({ tenantId }).lean(),
    Strain.find({ tenantId }).lean(),
    RoomAssignment.find({ tenantId, active: true }).select("roomId").lean(),
  ]);

  if (strains.length === 0) {
    throw new Error("No strains found for tenant — add strains before seeding batches");
  }

  const locationById = new Map(
    locations.map((location) => [String(location._id), location]),
  );

  const assignedRoomIds = new Set(
    activeAssignments.map((assignment) => String(assignment.roomId)),
  );

  const unassignedRooms = rooms.filter(
    (room) => !assignedRoomIds.has(String(room._id)),
  );

  if (unassignedRooms.length === 0) {
    console.log("Every room already has an active batch assignment.");
    return;
  }

  console.log(`Tenant: ${tenantId}`);
  console.log(`Rooms missing batches: ${unassignedRooms.length}\n`);

  const countersByPrefix = {};

  for (let index = 0; index < unassignedRooms.length; index += 1) {
    const room = unassignedRooms[index];
    const location = locationById.get(String(room.locationId));
    const locationName = location?.nickname || "Unknown";
    const prefix =
      LOCATION_PREFIX[locationName] ||
      String(locationName)
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) ||
      "MB";

    if (!countersByPrefix[prefix]) {
      countersByPrefix[prefix] = await nextBatchNumber(tenantId, prefix);
    } else {
      const current = parseBatchCounter(countersByPrefix[prefix], prefix);
      countersByPrefix[prefix] = `${prefix}-${String(current + 1).padStart(3, "0")}`;
    }

    const batchNumber = countersByPrefix[prefix];
    const lifecycleStage = STAGE_BY_ROOM_TYPE[room.type];

    if (!lifecycleStage) {
      console.log(
        `  Skip ${locationName} / ${room.name} (${room.type}) — unsupported room type`,
      );
      continue;
    }

    const seed = index + room.name.length + String(room._id).length;
    const { strainCount, totalPlants } = plantTotalsForRoomType(room.type, seed);
    const plants = buildPlantMix(strains, seed, strainCount, totalPlants);
    const dates = buildBatchDates(room.type, seed);
    const batchType = room.type === "Mom" ? "mom" : "production";

    const batch = await Batch.create({
      tenantId,
      batchNumber,
      batchType,
      cloneDate: dates.cloneDate,
      harvestDate: dates.harvestDate,
      location: room.locationId,
      plants,
      lifecycleStage,
      stageStartedAt: dates.stageStartedAt,
    });

    await RoomAssignment.create({
      tenantId,
      batchId: batch._id,
      roomId: room._id,
      assignedPlants: plants,
      active: true,
      source: "manual",
      startedAt: dates.stageStartedAt,
    });

    const plantTotal = plants.reduce((sum, row) => sum + row.count, 0);
    console.log(
      `  ${locationName} / ${room.name} (${room.type}) -> ${batchNumber} [${lifecycleStage}, ${plantTotal} plants]`,
    );
  }

  const remaining = await Room.find({ tenantId }).lean();
  const assignmentsAfter = await RoomAssignment.find({
    tenantId,
    active: true,
  })
    .select("roomId")
    .lean();
  const covered = new Set(
    assignmentsAfter.map((assignment) => String(assignment.roomId)),
  );
  const stillEmpty = remaining.filter((room) => !covered.has(String(room._id)));

  console.log("");
  console.log(`Active assignments: ${assignmentsAfter.length}`);
  console.log(`Rooms covered: ${covered.size} / ${remaining.length}`);

  if (stillEmpty.length > 0) {
    console.log("\nRooms still without batches:");
    stillEmpty.forEach((room) => {
      const location = locationById.get(String(room.locationId));
      console.log(`  ${location?.nickname || "?"} / ${room.name} (${room.type})`);
    });
    process.exitCode = 1;
  } else {
    console.log("\nDone — every room now has at least one active batch.");
    console.log("Login: admin@demo.local / demo1234");
  }
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
