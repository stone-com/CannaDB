const Batch = require("../../models/Batch");
const Harvest = require("../../models/Harvest");
const RoomAssignment = require("../../models/RoomAssignment");

const CLONE_DAYS = 14;
const VEG_DAYS = 14;
const FLOWER_DAYS = 7;
const CYCLE_DAYS = CLONE_DAYS + VEG_DAYS + FLOWER_DAYS;

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

function getFridayOnOrBefore(date) {
  const d = atHour(date);
  const day = d.getDay();
  const daysSinceFriday = (day + 2) % 7;
  return addDays(d, -daysSinceFriday);
}

function getNextFriday(date) {
  const d = atHour(date);
  const day = d.getDay();
  if (day === 5) return addDays(d, 7);
  return addDays(d, (5 - day + 7) % 7);
}

function variance(base, spread = 0.12) {
  const factor = 1 + (Math.random() * 2 - 1) * spread;
  return Math.round(base * factor);
}

function seededInt(min, max, seed) {
  const span = max - min + 1;
  return min + (Math.abs(seed * 9301 + 49297) % span);
}

function defaultDryPerPlant(strain) {
  if (Number.isFinite(strain.avgWeightPerPlant) && strain.avgWeightPerPlant > 0) {
    return strain.avgWeightPerPlant;
  }
  return 48 + (String(strain.name).length % 18);
}

function pickStrainMix(strains, seed, minCount, maxCount) {
  let pool = strains.filter((strain) => strain.status !== "pheno");
  if (pool.length < minCount) {
    pool = strains;
  }
  const desired = seededInt(minCount, maxCount, seed);
  const count = Math.min(desired, pool.length);
  const shuffled = [...pool].sort((a, b) => {
    const aKey = (seed + String(a.name).length * 17) % 101;
    const bKey = (seed + String(b.name).length * 23 + 7) % 101;
    return aKey - bKey;
  });

  return shuffled.slice(0, count);
}

function buildPlantMix(strains, seed, minCount, maxCount, totalPlants) {
  const selected = pickStrainMix(strains, seed, minCount, maxCount);
  const mix = [];
  let remaining = totalPlants;

  for (let i = 0; i < selected.length - 1; i += 1) {
    const baseShare = Math.round(remaining / (selected.length - i));
    const count = Math.max(6, variance(baseShare, 0.18));
    const capped = Math.min(count, remaining - (selected.length - i - 1) * 6);
    mix.push({
      strainId: selected[i]._id,
      count: capped,
      dryPerPlant: defaultDryPerPlant(selected[i]),
      strainName: selected[i].name,
    });
    remaining -= capped;
  }

  const last = selected[selected.length - 1];
  mix.push({
    strainId: last._id,
    count: Math.max(6, remaining),
    dryPerPlant: defaultDryPerPlant(last),
    strainName: last.name,
  });

  return mix;
}

function splitWetTotes(wetWeight, seed) {
  const toteCount = 1 + (seed % 3);
  const totes = [];
  let remaining = wetWeight;

  for (let i = 0; i < toteCount - 1; i += 1) {
    const portion = Math.max(
      800,
      Math.round(remaining / (toteCount - i) * (0.85 + (seed % 7) * 0.03)),
    );
    totes.push({ wetWeight: portion });
    remaining -= portion;
  }

  totes.push({ wetWeight: Math.max(500, remaining) });
  return totes;
}

function buildHarvestStrainRows(plantMix, seed) {
  return plantMix.map((entry, index) => {
    const dryWeight = variance(entry.count * entry.dryPerPlant, 0.14);
    const wetWeight = variance(dryWeight * (4.05 + (index % 3) * 0.05), 0.08);

    return {
      strainId: entry.strainId,
      plantCount: entry.count,
      totes: splitWetTotes(wetWeight, seed + index),
      totalDryWeightGrams: dryWeight,
    };
  });
}

function batchRoomsEntry(roomId, plantMix) {
  return {
    roomId,
    plants: plantMix.map(({ strainId, count }) => ({ strainId, count })),
  };
}

async function clearOperationalData(tenantId) {
  await Promise.all([
    RoomAssignment.deleteMany({ tenantId }),
    Harvest.deleteMany({ tenantId }),
    Batch.deleteMany({ tenantId }),
  ]);
}

async function createAssignment({
  tenantId,
  batchId,
  roomId,
  plantMix,
  startedAt,
  active = true,
}) {
  return RoomAssignment.create({
    tenantId,
    batchId,
    roomId,
    assignedPlants: plantMix.map(({ strainId, count }) => ({
      strainId,
      count,
    })),
    active,
    startedAt,
    endedAt: active ? null : startedAt,
    source: "manual",
  });
}

async function finalizeCompletedBatch(batchId, harvestId, harvestDate) {
  await Batch.collection.updateOne(
    { _id: batchId },
    {
      $set: {
        harvestId,
        lifecycleStage: "Completed",
        stageStartedAt: addDays(harvestDate, 5),
      },
    },
  );
}

async function createCompletedHarvest({
  tenantId,
  batchId,
  locationId,
  flowerRoomId,
  plantMix,
  harvestDate,
  harvestNumber,
  seed,
}) {
  const harvest = new Harvest({
    tenantId,
    harvestNumber,
    batchId,
    locationId,
    harvestDate,
    rooms: [
      {
        roomId: flowerRoomId,
        strains: buildHarvestStrainRows(plantMix, seed),
      },
    ],
  });

  await harvest.save();
  await finalizeCompletedBatch(batchId, harvest._id, harvestDate);
  return harvest;
}

function groupRoomsByType(rooms) {
  return rooms.reduce((acc, room) => {
    if (!acc[room.type]) acc[room.type] = [];
    acc[room.type].push(room);
    return acc;
  }, {});
}

function requiredRoomsPresent(roomsByType) {
  return (
    roomsByType.Flower?.length &&
    roomsByType.Veg?.length &&
    roomsByType.Clone?.length &&
    roomsByType.Mom?.length
  );
}

async function seedLocationGrowData({
  tenantId,
  location,
  rooms,
  strains,
  batchPrefix,
  harvestPrefix,
  historicalWeeks = 20,
  strainsPerBatchMin = 6,
  strainsPerBatchMax = 8,
  totalPlantsBase = 150,
  cloneBatchCount = 3,
  momBatchCount = 3,
}) {
  const roomsByType = groupRoomsByType(rooms);
  if (!requiredRoomsPresent(roomsByType)) {
    console.log(`  Skipping ${location.nickname} — missing required room types`);
    return { batches: 0, harvests: 0, assignments: 0 };
  }

  const flowerRoom = roomsByType.Flower[0];
  const vegRoom = roomsByType.Veg[0];
  const cloneRoom = roomsByType.Clone[0];
  const momRoom = roomsByType.Mom[0];

  const today = atHour(new Date());
  const lastHarvestFriday = getFridayOnOrBefore(today);
  const nextHarvestFriday = getNextFriday(today);

  let batchCounter = 0;
  let harvestCounter = 0;
  let assignmentCounter = 0;
  let liveCounter = 0;

  for (let i = 0; i < historicalWeeks; i += 1) {
    const weeksAgo = historicalWeeks - 1 - i;
    const harvestDate = addDays(lastHarvestFriday, -weeksAgo * 7);
    const cloneDate = addDays(harvestDate, -CYCLE_DAYS);
    const seed = i + batchCounter;
    const plantMix = buildPlantMix(
      strains,
      seed,
      strainsPerBatchMin,
      strainsPerBatchMax,
      variance(totalPlantsBase, 0.12),
    );
    batchCounter += 1;

    const batch = await Batch.create({
      tenantId,
      batchNumber: `${batchPrefix}-${String(batchCounter).padStart(3, "0")}`,
      batchType: "production",
      cloneDate,
      harvestDate,
      location: location._id,
      lifecycleStage: "Completed",
      stageStartedAt: addDays(harvestDate, 5),
      rooms: [batchRoomsEntry(flowerRoom._id, plantMix)],
    });

    await createCompletedHarvest({
      tenantId,
      batchId: batch._id,
      locationId: location._id,
      flowerRoomId: flowerRoom._id,
      plantMix,
      harvestDate,
      harvestNumber: `${harvestPrefix}-${String(++harvestCounter).padStart(3, "0")}`,
      seed,
    });
  }

  liveCounter += 1;
  const flowerMix = buildPlantMix(
    strains,
    historicalWeeks + liveCounter,
    strainsPerBatchMin,
    strainsPerBatchMax,
    variance(totalPlantsBase + 8, 0.1),
  );
  batchCounter += 1;

  const flowerBatch = await Batch.create({
    tenantId,
    batchNumber: `${batchPrefix}-${String(batchCounter).padStart(3, "0")}`,
    batchType: "production",
    cloneDate: addDays(nextHarvestFriday, -CYCLE_DAYS),
    harvestDate: nextHarvestFriday,
    location: location._id,
    lifecycleStage: "Flower",
    stageStartedAt: addDays(nextHarvestFriday, -FLOWER_DAYS),
    rooms: [batchRoomsEntry(flowerRoom._id, flowerMix)],
  });

  await createAssignment({
    tenantId,
    batchId: flowerBatch._id,
    roomId: flowerRoom._id,
    plantMix: flowerMix,
    startedAt: addDays(nextHarvestFriday, -FLOWER_DAYS),
  });
  assignmentCounter += 1;

  liveCounter += 1;
  const vegHarvestDate = addDays(nextHarvestFriday, 7);
  const vegMix = buildPlantMix(
    strains,
    historicalWeeks + liveCounter,
    strainsPerBatchMin,
    strainsPerBatchMax,
    variance(totalPlantsBase + 4, 0.1),
  );
  batchCounter += 1;

  const vegBatch = await Batch.create({
    tenantId,
    batchNumber: `${batchPrefix}-${String(batchCounter).padStart(3, "0")}`,
    batchType: "production",
    cloneDate: addDays(vegHarvestDate, -CYCLE_DAYS),
    harvestDate: vegHarvestDate,
    location: location._id,
    lifecycleStage: "Veg",
    stageStartedAt: addDays(vegHarvestDate, -(VEG_DAYS + FLOWER_DAYS)),
    rooms: [batchRoomsEntry(vegRoom._id, vegMix)],
  });

  await createAssignment({
    tenantId,
    batchId: vegBatch._id,
    roomId: vegRoom._id,
    plantMix: vegMix,
    startedAt: addDays(vegHarvestDate, -(VEG_DAYS + FLOWER_DAYS)),
  });
  assignmentCounter += 1;

  for (let i = 0; i < cloneBatchCount; i += 1) {
    liveCounter += 1;
    const harvestDate = addDays(nextHarvestFriday, (2 - i + 2) * 7);
    const cloneDate = addDays(harvestDate, -CYCLE_DAYS);
    const cloneMix = buildPlantMix(
      strains,
      historicalWeeks + liveCounter + i * 11,
      strainsPerBatchMin,
      strainsPerBatchMax,
      variance(totalPlantsBase - 20 + i * 8, 0.12),
    );
    batchCounter += 1;

    const batch = await Batch.create({
      tenantId,
      batchNumber: `${batchPrefix}-${String(batchCounter).padStart(3, "0")}`,
      batchType: "production",
      cloneDate,
      harvestDate,
      location: location._id,
      lifecycleStage: "Clone",
      stageStartedAt: cloneDate,
      rooms: [batchRoomsEntry(cloneRoom._id, cloneMix)],
    });

    await createAssignment({
      tenantId,
      batchId: batch._id,
      roomId: cloneRoom._id,
      plantMix: cloneMix,
      startedAt: cloneDate,
    });
    assignmentCounter += 1;
  }

  for (let i = 0; i < momBatchCount; i += 1) {
    const strain = strains[i % strains.length];
    const momPlants = 16 + (i % 4) * 4;
    const cloneDate = addDays(today, -(95 + i * 20));
    batchCounter += 1;

    const momBatch = await Batch.create({
      tenantId,
      batchNumber: `${batchPrefix}-MOM-${String(i + 1).padStart(2, "0")}`,
      batchType: "mom",
      cloneDate,
      location: location._id,
      lifecycleStage: "Mom",
      stageStartedAt: addDays(cloneDate, 42),
      rooms: [
        {
          roomId: momRoom._id,
          plants: [{ strainId: strain._id, count: momPlants }],
        },
      ],
    });

    await createAssignment({
      tenantId,
      batchId: momBatch._id,
      roomId: momRoom._id,
      plantMix: [{ strainId: strain._id, count: momPlants }],
      startedAt: addDays(cloneDate, 42),
    });
    assignmentCounter += 1;
  }

  return {
    batches: batchCounter,
    harvests: harvestCounter,
    assignments: assignmentCounter,
  };
}

module.exports = {
  CLONE_DAYS,
  VEG_DAYS,
  FLOWER_DAYS,
  CYCLE_DAYS,
  clearOperationalData,
  seedLocationGrowData,
  groupRoomsByType,
};
