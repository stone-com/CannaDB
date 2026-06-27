/**
 * Rebuilds realistic dummy data for the Green Valley demo tenant (ops@greenvalley.local).
 *
 * - Clears existing batches, room assignments, harvests, and audit logs
 * - Seeds 7+ months of Monday harvest history on an 8-week cycle (4 on, 1 off, 2 on, 1 off)
 * - Fills every room with an active batch
 * - Updates strain avgWeightPerPlant from historical harvest dry averages
 *
 * Usage:
 *   node scripts/seed-green-valley-dummy-data.js
 */

require("dotenv").config();

const mongoose = require("mongoose");

const User = require("../models/User");
const Location = require("../models/Location");
const Room = require("../models/Room");
const Strain = require("../models/Strain");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const RoomAssignment = require("../models/RoomAssignment");
const AuditLog = require("../models/AuditLog");
const { applyHarvestCalculations } = require("../utils/harvestCalculations");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

const GREEN_VALLEY_EMAIL = "ops@greenvalley.local";
const BATCH_PREFIX = "GV";

const CLONE_DAYS = 16;
const VEG_DAYS = 13;
const FLOWER_DAYS = 56;
const MOM_WEEKS = 4;
const HISTORY_MONTHS = 7;
const STRAINS_PER_BATCH = 8;
const DRYING_DAYS = 10;

const REFERENCE_MONDAY = new Date("2025-11-03T10:00:00.000Z");

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

function startOfDay(date) {
  return atHour(date, 0);
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / (24 * 60 * 60 * 1000));
}

function seededFloat(min, max, seed) {
  const t = Math.abs(Math.sin(seed * 12.9898) * 43758.5453);
  const frac = t - Math.floor(t);
  return min + frac * (max - min);
}

function seededInt(min, max, seed) {
  return Math.round(seededFloat(min, max, seed));
}

function pickStrains(strains, seed, count) {
  const pool = [...strains].sort((a, b) => {
    const aKey = (seed + String(a.name).length * 17) % 101;
    const bKey = (seed + String(b.name).length * 23 + 7) % 101;
    return aKey - bKey;
  });
  return pool.slice(0, Math.min(count, pool.length));
}

function buildPlantMix(strains, seed, strainCount, plantsPerStrainRange) {
  const selected = pickStrains(strains, seed, strainCount);
  return selected.map((strain, index) => ({
    strainId: strain._id,
    count: seededInt(plantsPerStrainRange[0], plantsPerStrainRange[1], seed + index * 31),
  }));
}

function getMondayWeekIndex(monday) {
  const weeks = Math.floor(daysBetween(REFERENCE_MONDAY, monday) / 7);
  return ((weeks % 8) + 8) % 8;
}

function isHarvestMonday(date) {
  if (date.getDay() !== 1) return false;
  const pos = getMondayWeekIndex(atHour(date));
  return [0, 1, 2, 3, 5, 6].includes(pos);
}

function getPreviousTuesday(date) {
  const d = atHour(date);
  const day = d.getDay();
  const offset = day >= 2 ? day - 2 : day + 5;
  return addDays(d, -offset);
}

function getNextTuesday(date) {
  const d = atHour(date);
  const day = d.getDay();
  const offset = day <= 2 ? 2 - day : 9 - day;
  return addDays(d, offset);
}

function buildLifecycleDates(harvestMonday) {
  const harvestDate = atHour(harvestMonday);
  const flowerStart = addDays(harvestDate, -FLOWER_DAYS);
  const vegStart = addDays(flowerStart, -VEG_DAYS);
  const idealClone = addDays(vegStart, -CLONE_DAYS);

  let cloneDate = getPreviousTuesday(idealClone);
  if (daysBetween(cloneDate, idealClone) > 4) {
    cloneDate = getNextTuesday(addDays(idealClone, -7));
  }

  return {
    cloneDate,
    vegStart: addDays(cloneDate, CLONE_DAYS),
    flowerStart: addDays(cloneDate, CLONE_DAYS + VEG_DAYS),
    harvestDate,
    dryComplete: addDays(harvestDate, DRYING_DAYS),
  };
}

function enumerateMondays(fromDate, toDate) {
  const mondays = [];
  let cursor = atHour(fromDate);
  while (cursor.getDay() !== 1) cursor = addDays(cursor, 1);

  while (cursor <= toDate) {
    mondays.push(new Date(cursor));
    cursor = addDays(cursor, 7);
  }
  return mondays;
}

function buildHarvestWeights(plants, roomSqFoot, seed) {
  const totalPlants = plants.reduce((sum, row) => sum + row.count, 0);
  const dryRatio = seededFloat(0.18, 0.22, seed + 401);

  const strains = plants.map((row, index) => {
    const plantCount = row.count;
    const yieldPerSqFt = seededFloat(80, 120, seed + index * 53);
    const allocatedSqFt = (plantCount / totalPlants) * roomSqFoot;
    const totalDryWeightGrams = Math.round(yieldPerSqFt * allocatedSqFt);
    const totalWetWeightGrams = Math.round(totalDryWeightGrams / dryRatio);

    const toteCount = seededInt(2, 4, seed + index * 19);
    const totes = [];
    let wetRemaining = totalWetWeightGrams;

    for (let t = 0; t < toteCount; t += 1) {
      const isLast = t === toteCount - 1;
      const wetWeight = isLast
        ? wetRemaining
        : Math.round(totalWetWeightGrams / toteCount);
      totes.push({ wetWeight });
      wetRemaining -= wetWeight;
    }

    return {
      strainId: row.strainId,
      plantCount,
      totes,
      totalDryWeightGrams,
    };
  });

  return { strains, dryRatio };
}

async function createClosedAssignment({
  tenantId,
  batchId,
  roomId,
  assignedPlants,
  startedAt,
  endedAt,
  source = "timer",
}) {
  return RoomAssignment.create({
    tenantId,
    batchId,
    roomId,
    assignedPlants,
    active: false,
    source,
    startedAt,
    endedAt,
  });
}

async function createActiveAssignment({
  tenantId,
  batchId,
  roomId,
  assignedPlants,
  startedAt,
  source = "manual",
}) {
  return RoomAssignment.create({
    tenantId,
    batchId,
    roomId,
    assignedPlants,
    active: true,
    source,
    startedAt,
  });
}

function pushAudit(auditEntries, { tenantId, userId, action, resourceType, resourceId, batchId, summary, occurredAt }) {
  auditEntries.push({
    tenantId,
    userId,
    action,
    resourceType,
    resourceId,
    batchId: batchId || null,
    summary,
    occurredAt,
  });
}

async function main() {
  console.log("Seed Green Valley dummy data");
  console.log(`Database: ${MONGODB_URI}\n`);

  await mongoose.connect(MONGODB_URI);

  const user = await User.findOne({ email: GREEN_VALLEY_EMAIL.toLowerCase() });
  if (!user) {
    throw new Error(`Green Valley user not found (${GREEN_VALLEY_EMAIL})`);
  }

  const tenantId = user.tenantId;
  const userId = user._id;

  const [location, rooms, strains] = await Promise.all([
    Location.findOne({ tenantId }).lean(),
    Room.find({ tenantId }).lean(),
    Strain.find({ tenantId }).lean(),
  ]);

  if (!location) throw new Error("No location found for Green Valley tenant");
  if (strains.length < STRAINS_PER_BATCH) {
    throw new Error(`Need at least ${STRAINS_PER_BATCH} strains — found ${strains.length}`);
  }

  const roomByType = {};
  rooms.forEach((room) => {
    if (!roomByType[room.type]) roomByType[room.type] = [];
    roomByType[room.type].push(room);
  });

  const cloneRoom = roomByType.Clone?.[0];
  const vegRoom = roomByType.Veg?.[0];
  const flowerRooms = roomByType.Flower || [];
  const momRoom = roomByType.Mom?.[0];
  const dryRoom = roomByType.Drying?.[0];

  for (const label of ["Clone", "Veg", "Flower", "Mom", "Drying"]) {
    if (label === "Flower" && flowerRooms.length === 0) {
      throw new Error("Missing Flower rooms");
    }
    if (label !== "Flower" && !roomByType[label]?.[0]) {
      throw new Error(`Missing ${label} room`);
    }
  }

  console.log("Clearing existing Green Valley batches, assignments, harvests, and logs...");
  await Promise.all([
    AuditLog.deleteMany({ tenantId }),
    Harvest.deleteMany({ tenantId }),
    RoomAssignment.deleteMany({ tenantId }),
    Batch.deleteMany({ tenantId }),
  ]);

  const today = atHour(new Date());
  const historyStart = addDays(today, -HISTORY_MONTHS * 30);
  const futureEnd = addDays(today, 14);

  const allMondays = enumerateMondays(historyStart, futureEnd);
  const harvestMondays = allMondays.filter(isHarvestMonday);
  const pastHarvestMondays = harvestMondays.filter((d) => d < today);
  const upcomingHarvestMondays = harvestMondays.filter((d) => d >= today);

  console.log(`Tenant: ${tenantId}`);
  console.log(`Location: ${location.nickname}`);
  console.log(`Strains: ${strains.length}`);
  console.log(`Historical harvest Mondays: ${pastHarvestMondays.length}`);
  console.log("");

  const auditEntries = [];
  const strainDryTotals = new Map();
  const strainDryCounts = new Map();

  let batchCounter = 0;
  let harvestCounter = 0;
  let momCounter = 0;

  const nextBatchNumber = () => {
    batchCounter += 1;
    return `${BATCH_PREFIX}-${String(batchCounter).padStart(3, "0")}`;
  };

  const nextHarvestNumber = () => {
    harvestCounter += 1;
    return `${BATCH_PREFIX}-H-${String(harvestCounter).padStart(3, "0")}`;
  };

  const momBatchesToCreate = [];

  for (let index = 0; index < pastHarvestMondays.length; index += 1) {
    const harvestMonday = pastHarvestMondays[index];
    const flowerRoom = flowerRooms[index % flowerRooms.length];
    const seed = index * 97 + flowerRoom.name.length * 13;
    const batchNumber = nextBatchNumber();
    const dates = buildLifecycleDates(harvestMonday);
    const plants = buildPlantMix(strains, seed, STRAINS_PER_BATCH, [70, 80]);
    const { strains: harvestStrains } = buildHarvestWeights(
      plants,
      flowerRoom.sqFoot || 1000,
      seed,
    );

    const batch = await Batch.create({
      tenantId,
      batchNumber,
      batchType: "production",
      cloneDate: dates.cloneDate,
      harvestDate: dates.harvestDate,
      location: location._id,
      plants,
      lifecycleStage: "Completed",
      stageStartedAt: dates.dryComplete,
      createdAt: dates.cloneDate,
    });

    const harvestDoc = new Harvest({
      tenantId,
      harvestNumber: nextHarvestNumber(),
      batchId: batch._id,
      locationId: location._id,
      rooms: [
        {
          roomId: flowerRoom._id,
          strains: harvestStrains,
        },
      ],
      harvestDate: dates.harvestDate,
      createdAt: dates.harvestDate,
    });
    await applyHarvestCalculations(harvestDoc);
    const harvest = await harvestDoc.save();

    await Batch.updateOne({ _id: batch._id }, { harvestId: harvest._id });

    harvestStrains.forEach((row) => {
      const key = String(row.strainId);
      const dryAvg = row.plantCount > 0 ? row.totalDryWeightGrams / row.plantCount : 0;
      strainDryTotals.set(key, (strainDryTotals.get(key) || 0) + dryAvg);
      strainDryCounts.set(key, (strainDryCounts.get(key) || 0) + 1);
    });

    await createClosedAssignment({
      tenantId,
      batchId: batch._id,
      roomId: cloneRoom._id,
      assignedPlants: plants,
      startedAt: dates.cloneDate,
      endedAt: dates.vegStart,
    });
    await createClosedAssignment({
      tenantId,
      batchId: batch._id,
      roomId: vegRoom._id,
      assignedPlants: plants,
      startedAt: dates.vegStart,
      endedAt: dates.flowerStart,
    });
    await createClosedAssignment({
      tenantId,
      batchId: batch._id,
      roomId: flowerRoom._id,
      assignedPlants: plants,
      startedAt: dates.flowerStart,
      endedAt: dates.harvestDate,
    });
    await createClosedAssignment({
      tenantId,
      batchId: batch._id,
      roomId: dryRoom._id,
      assignedPlants: plants,
      startedAt: dates.harvestDate,
      endedAt: dates.dryComplete,
    });

    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "create",
      resourceType: "batch",
      resourceId: batch._id,
      batchId: batch._id,
      summary: `Created batch ${batchNumber}`,
      occurredAt: addDays(dates.cloneDate, 1),
    });
    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "update",
      resourceType: "batch",
      resourceId: batch._id,
      batchId: batch._id,
      summary: `Moved batch ${batchNumber} to ${vegRoom.name} (Veg)`,
      occurredAt: dates.vegStart,
    });
    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "update",
      resourceType: "batch",
      resourceId: batch._id,
      batchId: batch._id,
      summary: `Moved batch ${batchNumber} to ${flowerRoom.name} (Flower)`,
      occurredAt: dates.flowerStart,
    });

    if (seededInt(1, 100, seed) <= 18) {
      const destroyStrain = plants[seededInt(0, plants.length - 1, seed + 77)];
      const destroyCount = seededInt(2, 8, seed + 88);
      pushAudit(auditEntries, {
        tenantId,
        userId,
        action: "update",
        resourceType: "batch",
        resourceId: batch._id,
        batchId: batch._id,
        summary: `Removed ${destroyCount} plants from batch ${batchNumber}`,
        occurredAt: addDays(dates.flowerStart, seededInt(5, 30, seed + 99)),
      });
    }

    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "create",
      resourceType: "harvest",
      resourceId: harvest._id,
      batchId: batch._id,
      summary: `Created harvest ${harvest.harvestNumber}`,
      occurredAt: dates.harvestDate,
    });
    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "update",
      resourceType: "harvest",
      resourceId: harvest._id,
      batchId: batch._id,
      summary: `Finalized dry weights for harvest ${harvest.harvestNumber}`,
      occurredAt: dates.dryComplete,
    });

    momBatchesToCreate.push({
      sourceBatchNumber: batchNumber,
      sourceBatchId: batch._id,
      plants,
      createdAt: dates.flowerStart,
      seed: seed + 1000,
    });
  }

  for (const momSpec of momBatchesToCreate) {
    const momPlants = momSpec.plants.map((row, idx) => ({
      strainId: row.strainId,
      count: seededInt(2, 3, momSpec.seed + idx * 7),
    }));

    if (momPlants.every((row) => row.count === 0)) continue;

    momCounter += 1;
    const momBatchNumber = `${momSpec.sourceBatchNumber}-MOM-${String(momCounter).padStart(3, "0")}`;
    const momStart = momSpec.createdAt;
    const momComplete = addDays(momStart, MOM_WEEKS * 7);
    const isActive = momComplete > today;

    const momBatch = await Batch.create({
      tenantId,
      batchNumber: momBatchNumber,
      batchType: "mom",
      cloneDate: momStart,
      harvestDate: null,
      location: location._id,
      plants: momPlants,
      lifecycleStage: isActive ? "Mom" : "Completed",
      stageStartedAt: momStart,
      createdAt: momStart,
    });

    if (isActive) {
      await createActiveAssignment({
        tenantId,
        batchId: momBatch._id,
        roomId: momRoom._id,
        assignedPlants: momPlants,
        startedAt: momStart,
      });
    } else {
      await createClosedAssignment({
        tenantId,
        batchId: momBatch._id,
        roomId: momRoom._id,
        assignedPlants: momPlants,
        startedAt: momStart,
        endedAt: momComplete,
      });
    }

    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "create",
      resourceType: "batch",
      resourceId: momBatch._id,
      batchId: momSpec.sourceBatchId,
      summary: `Created mom batch ${momBatchNumber}`,
      occurredAt: momStart,
    });
  }

  strains.forEach((strain, index) => {
    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "create",
      resourceType: "strain",
      resourceId: strain._id,
      summary: `Created strain ${strain.name}`,
      occurredAt: addDays(historyStart, index * 2),
    });
  });

  console.log("Creating current active batches for all rooms...");

  const nextHarvest = upcomingHarvestMondays[0] || addDays(today, 7 - today.getDay() + 1);
  const activeSpecs = [];

  const dryingHarvestMonday = pastHarvestMondays[pastHarvestMondays.length - 1];
  if (dryingHarvestMonday) {
    const dryingDates = buildLifecycleDates(dryingHarvestMonday);
    if (dryingDates.dryComplete > today) {
      const seed = 88001;
      const batchNumber = nextBatchNumber();
      const flowerRoom = flowerRooms[pastHarvestMondays.length % flowerRooms.length];
      const plants = buildPlantMix(strains, seed, STRAINS_PER_BATCH, [70, 80]);
      const { strains: harvestStrains } = buildHarvestWeights(
        plants,
        flowerRoom.sqFoot || 1000,
        seed,
      );

      const batch = await Batch.create({
        tenantId,
        batchNumber,
        batchType: "production",
        cloneDate: dryingDates.cloneDate,
        harvestDate: dryingDates.harvestDate,
        location: location._id,
        plants,
        lifecycleStage: "Drying",
        stageStartedAt: dryingDates.harvestDate,
        createdAt: dryingDates.cloneDate,
      });

      const harvestDoc = new Harvest({
        tenantId,
        harvestNumber: nextHarvestNumber(),
        batchId: batch._id,
        locationId: location._id,
        rooms: [{ roomId: flowerRoom._id, strains: harvestStrains }],
        harvestDate: dryingDates.harvestDate,
        createdAt: dryingDates.harvestDate,
      });
      await applyHarvestCalculations(harvestDoc);
      const harvest = await harvestDoc.save();
      await Batch.updateOne({ _id: batch._id }, { harvestId: harvest._id });

      await createActiveAssignment({
        tenantId,
        batchId: batch._id,
        roomId: dryRoom._id,
        assignedPlants: plants,
        startedAt: dryingDates.harvestDate,
      });

      pushAudit(auditEntries, {
        tenantId,
        userId,
        action: "create",
        resourceType: "harvest",
        resourceId: harvest._id,
        batchId: batch._id,
        summary: `Created harvest ${harvest.harvestNumber}`,
        occurredAt: dryingDates.harvestDate,
      });

      activeSpecs.push({ room: dryRoom, batch, skip: true });
    }
  }

  const flowerTargets = [
    { roomIndex: 0, harvestMonday: nextHarvest, stage: "HarvestReady" },
    {
      roomIndex: 1,
      harvestMonday: harvestMondays.find((d) => d > nextHarvest) || addDays(nextHarvest, 14),
      stage: "Flower",
    },
    {
      roomIndex: 2,
      harvestMonday:
        harvestMondays.filter((d) => d > nextHarvest)[1] || addDays(nextHarvest, 28),
      stage: "Flower",
    },
  ];

  for (let i = 0; i < flowerTargets.length; i += 1) {
    const target = flowerTargets[i];
    const flowerRoom = flowerRooms[target.roomIndex % flowerRooms.length];
    const dates = buildLifecycleDates(target.harvestMonday);
    const seed = 77000 + i * 111;
    const batchNumber = nextBatchNumber();
    const plants = buildPlantMix(strains, seed, STRAINS_PER_BATCH, [70, 80]);

    let lifecycleStage = target.stage;
    let stageStartedAt = dates.flowerStart;

    if (target.stage === "Flower") {
      const daysInFlower = daysBetween(dates.flowerStart, today);
      stageStartedAt = addDays(today, -Math.min(daysInFlower, FLOWER_DAYS - 7));
    }
    if (target.stage === "HarvestReady") {
      stageStartedAt = addDays(dates.harvestDate, -3);
    }

    const batch = await Batch.create({
      tenantId,
      batchNumber,
      batchType: "production",
      cloneDate: dates.cloneDate,
      harvestDate: dates.harvestDate,
      location: location._id,
      plants,
      lifecycleStage,
      stageStartedAt,
      createdAt: dates.cloneDate,
    });

    await createActiveAssignment({
      tenantId,
      batchId: batch._id,
      roomId: flowerRoom._id,
      assignedPlants: plants,
      startedAt: dates.flowerStart,
    });

    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "create",
      resourceType: "batch",
      resourceId: batch._id,
      batchId: batch._id,
      summary: `Created batch ${batchNumber}`,
      occurredAt: dates.cloneDate,
    });

    activeSpecs.push({ room: flowerRoom, batch, skip: true });
  }

  const vegHarvestMonday =
    harvestMondays.filter((d) => d > nextHarvest)[2] || addDays(nextHarvest, 42);
  const vegDates = buildLifecycleDates(vegHarvestMonday);
  const vegSeed = 66001;
  const vegBatchNumber = nextBatchNumber();
  const vegPlants = buildPlantMix(strains, vegSeed, STRAINS_PER_BATCH, [70, 80]);
  const vegBatch = await Batch.create({
    tenantId,
    batchNumber: vegBatchNumber,
    batchType: "production",
    cloneDate: vegDates.cloneDate,
    harvestDate: vegDates.harvestDate,
    location: location._id,
    plants: vegPlants,
    lifecycleStage: "Veg",
    stageStartedAt: vegDates.vegStart,
    createdAt: vegDates.cloneDate,
  });
  await createActiveAssignment({
    tenantId,
    batchId: vegBatch._id,
    roomId: vegRoom._id,
    assignedPlants: vegPlants,
    startedAt: vegDates.vegStart,
  });
  pushAudit(auditEntries, {
    tenantId,
    userId,
    action: "create",
    resourceType: "batch",
    resourceId: vegBatch._id,
    batchId: vegBatch._id,
    summary: `Created batch ${vegBatchNumber}`,
    occurredAt: vegDates.cloneDate,
  });
  pushAudit(auditEntries, {
    tenantId,
    userId,
    action: "update",
    resourceType: "batch",
    resourceId: vegBatch._id,
    batchId: vegBatch._id,
    summary: `Moved batch ${vegBatchNumber} to ${vegRoom.name} (Veg)`,
    occurredAt: vegDates.vegStart,
  });

  const cloneHarvestMonday =
    harvestMondays.filter((d) => d > nextHarvest)[3] || addDays(nextHarvest, 56);
  const cloneDates = buildLifecycleDates(cloneHarvestMonday);
  const cloneSeed = 55001;
  const cloneBatchNumber = nextBatchNumber();
  const clonePlants = buildPlantMix(strains, cloneSeed, STRAINS_PER_BATCH, [70, 80]);
  const cloneTuesday = getPreviousTuesday(today);
  const cloneBatch = await Batch.create({
    tenantId,
    batchNumber: cloneBatchNumber,
    batchType: "production",
    cloneDate: cloneTuesday,
    harvestDate: cloneDates.harvestDate,
    location: location._id,
    plants: clonePlants,
    lifecycleStage: "Clone",
    stageStartedAt: cloneTuesday,
    createdAt: cloneTuesday,
  });
  await createActiveAssignment({
    tenantId,
    batchId: cloneBatch._id,
    roomId: cloneRoom._id,
    assignedPlants: clonePlants,
    startedAt: cloneTuesday,
  });
  pushAudit(auditEntries, {
    tenantId,
    userId,
    action: "create",
    resourceType: "batch",
    resourceId: cloneBatch._id,
    batchId: cloneBatch._id,
    summary: `Created batch ${cloneBatchNumber}`,
    occurredAt: cloneTuesday,
  });

  const activeMomCount = await RoomAssignment.countDocuments({
    tenantId,
    roomId: momRoom._id,
    active: true,
  });

  if (activeMomCount === 0) {
    const momSeed = 44001;
    const momPlants = buildPlantMix(strains, momSeed, 6, [2, 3]).map((row) => ({
      ...row,
      count: seededInt(2, 3, momSeed + String(row.strainId).length),
    }));
    momCounter += 1;
    const momBatchNumber = `${BATCH_PREFIX}-MOM-${String(momCounter).padStart(3, "0")}`;
    const momStarted = addDays(today, -seededInt(7, 21, momSeed));

    const momBatch = await Batch.create({
      tenantId,
      batchNumber: momBatchNumber,
      batchType: "mom",
      cloneDate: momStarted,
      harvestDate: null,
      location: location._id,
      plants: momPlants,
      lifecycleStage: "Mom",
      stageStartedAt: momStarted,
      createdAt: momStarted,
    });

    await createActiveAssignment({
      tenantId,
      batchId: momBatch._id,
      roomId: momRoom._id,
      assignedPlants: momPlants,
      startedAt: momStarted,
    });

    pushAudit(auditEntries, {
      tenantId,
      userId,
      action: "create",
      resourceType: "batch",
      resourceId: momBatch._id,
      batchId: momBatch._id,
      summary: `Created mom batch ${momBatchNumber}`,
      occurredAt: momStarted,
    });
  }

  console.log("Updating strain average dry weights from harvest history...");
  for (const strain of strains) {
    const key = String(strain._id);
    const total = strainDryTotals.get(key) || 0;
    const count = strainDryCounts.get(key) || 0;
    if (count > 0) {
      const avgDry = Math.round((total / count) * 10) / 10;
      await Strain.updateOne({ _id: strain._id }, { avgWeightPerPlant: avgDry });
    }
  }

  auditEntries.sort((a, b) => a.occurredAt - b.occurredAt);
  if (auditEntries.length > 0) {
    await AuditLog.insertMany(auditEntries, { ordered: false });
  }

  const [batchCount, harvestCount, activeAssignments, coveredRoomIds] = await Promise.all([
    Batch.countDocuments({ tenantId }),
    Harvest.countDocuments({ tenantId }),
    RoomAssignment.countDocuments({ tenantId, active: true }),
    RoomAssignment.distinct("roomId", { tenantId, active: true }),
  ]);

  const uncoveredRooms = rooms.filter(
    (room) => !coveredRoomIds.some((id) => String(id) === String(room._id)),
  );

  console.log("");
  console.log(`Completed batches (historical): ${pastHarvestMondays.length}`);
  console.log(`Mom batches created: ${momCounter}`);
  console.log(`Total batches: ${batchCount}`);
  console.log(`Total harvests: ${harvestCount}`);
  console.log(`Active room assignments: ${activeAssignments}`);
  console.log(`Audit log entries: ${auditEntries.length}`);
  console.log(`Rooms covered: ${coveredRoomIds.length} / ${rooms.length}`);

  if (uncoveredRooms.length > 0) {
    console.log("\nWarning — rooms still without active batch:");
    uncoveredRooms.forEach((room) => console.log(`  ${room.name} (${room.type})`));
    process.exitCode = 1;
  } else {
    console.log("\nDone — Green Valley dummy data seeded successfully.");
    console.log(`Login: ${GREEN_VALLEY_EMAIL} / green1234`);
  }
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error.message);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
