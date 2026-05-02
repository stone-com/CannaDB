require("dotenv").config();
const mongoose = require("mongoose");

const Company = require("../models/Company");
const Location = require("../models/Location");
const Room = require("../models/Room");
const Strain = require("../models/Strain");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const DryRoomData = require("../models/DryRoomData");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

const COMPANY_NAME = "Mount Baker Homegrown";

const MOOSE_LOCATION = "Moose Lodge";
const IRON_LOCATION = "Iron Gate";

const TOTAL_HARVESTS = 18;
const FUTURE_HARVESTS = 4;
const MOM_PLANTS_PER_BATCH = 16;
const DRYING_DAYS = 10;

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getNextMonday(baseDate) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  return addDays(date, daysUntilMonday);
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickEightUnique(strains, startIndex) {
  const picked = [];
  const used = new Set();

  let i = 0;
  while (picked.length < 8 && i < strains.length * 2) {
    const idx = (startIndex + i) % strains.length;
    const strain = strains[idx];
    if (!used.has(String(strain._id))) {
      used.add(String(strain._id));
      picked.push(strain);
    }
    i += 1;
  }

  return picked;
}

function allocateCounts(totalPlants, itemCount) {
  // Create random weights, then scale to totalPlants.
  const weights = Array.from({ length: itemCount }, () => randInt(6, 14));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  const raw = weights.map((w) =>
    Math.max(1, Math.round((w / weightSum) * totalPlants)),
  );

  // Fix rounding drift so the final sum exactly equals totalPlants.
  let diff = totalPlants - raw.reduce((sum, n) => sum + n, 0);
  let cursor = 0;
  while (diff !== 0) {
    const dir = diff > 0 ? 1 : -1;
    const idx = cursor % raw.length;
    if (!(raw[idx] <= 1 && dir < 0)) {
      raw[idx] += dir;
      diff -= dir;
    }
    cursor += 1;
  }

  return raw;
}

function splitIntoTotes(totalWet, toteCount) {
  if (totalWet <= 0 || toteCount <= 0) return [];

  const pieces = [];
  let remaining = totalWet;

  for (let i = 0; i < toteCount - 1; i += 1) {
    const minChunk = Math.max(1, Math.floor(remaining / (toteCount - i + 1)));
    const maxChunk = Math.max(minChunk, Math.floor(remaining / 2));
    const chunk = randInt(minChunk, maxChunk);
    pieces.push(chunk);
    remaining -= chunk;
  }

  pieces.push(remaining);
  return pieces.map((wetWeight) => ({ wetWeight }));
}

function deriveLifecycle(cloneDate, harvestDate, now) {
  const cloneStart = new Date(cloneDate);
  const vegStart = addDays(cloneStart, 16);
  const flowerStart = addDays(vegStart, 13);
  const harvestReadyStart = addDays(flowerStart, 54);
  const dryingEnd = addDays(harvestDate, DRYING_DAYS);

  if (now < vegStart) {
    return {
      stage: "Clone",
      stageStartedAt: cloneStart,
      nextTransitionAt: vegStart,
      occupancy: "clone",
    };
  }

  if (now < flowerStart) {
    return {
      stage: "Veg",
      stageStartedAt: vegStart,
      nextTransitionAt: flowerStart,
      occupancy: "veg",
    };
  }

  if (now < harvestReadyStart) {
    return {
      stage: "Flower",
      stageStartedAt: flowerStart,
      nextTransitionAt: harvestReadyStart,
      occupancy: "flower",
    };
  }

  if (now < harvestDate) {
    return {
      stage: "HarvestReady",
      stageStartedAt: harvestReadyStart,
      nextTransitionAt: harvestDate,
      occupancy: "flower",
    };
  }

  if (now < dryingEnd) {
    return {
      stage: "Drying",
      stageStartedAt: harvestDate,
      nextTransitionAt: dryingEnd,
      occupancy: "drying",
    };
  }

  return {
    stage: "Completed",
    stageStartedAt: dryingEnd,
    nextTransitionAt: null,
    occupancy: "completed",
  };
}

async function wipeEverythingExceptStrains() {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const protectedCollections = new Set(["strains"]);

  for (const collection of collections) {
    const name = collection.name;
    if (name.startsWith("system.")) continue;
    if (protectedCollections.has(name)) continue;
    await mongoose.connection.collection(name).deleteMany({});
  }
}

async function run() {
  await mongoose.connect(MONGODB_URI);

  const now = new Date();

  // 1) Delete all data except strains.
  await wipeEverythingExceptStrains();

  // 2) Load strains and validate minimum required count.
  const strains = await Strain.find().sort({ name: 1 }).lean();
  if (strains.length < 8) {
    throw new Error(
      `Need at least 8 strains in DB to satisfy 8 distinct strains per harvest. Found ${strains.length}.`,
    );
  }

  // 3) Create company + locations.
  const company = await Company.create({ name: COMPANY_NAME });

  const [mooseLocation, ironLocation] = await Location.create([
    {
      companyId: company._id,
      nickname: MOOSE_LOCATION,
      address: "Bellingham, WA",
    },
    {
      companyId: company._id,
      nickname: IRON_LOCATION,
      address: "Mount Vernon, WA",
    },
  ]);

  // 4) Create rooms for each location.
  const mooseRoomsSpec = [
    { name: "A", type: "Flower", sqFoot: 900 },
    { name: "B", type: "Flower", sqFoot: 900 },
    { name: "C", type: "Flower", sqFoot: 900 },
    { name: "Veg Room", type: "Veg", sqFoot: 500 },
    { name: "Clone Room", type: "Clone", sqFoot: 300 },
    { name: "Mom Room", type: "Mom", sqFoot: 400 },
    { name: "Dry Room 1", type: "Drying", sqFoot: 450 },
    { name: "Dry Room 2", type: "Drying", sqFoot: 450 },
  ];

  const ironRoomsSpec = [
    { name: "A", type: "Flower", sqFoot: 700 },
    { name: "B", type: "Flower", sqFoot: 700 },
    { name: "C", type: "Flower", sqFoot: 700 },
    { name: "D", type: "Flower", sqFoot: 700 },
    { name: "A2", type: "Flower", sqFoot: 650 },
    { name: "B2", type: "Flower", sqFoot: 650 },
    { name: "C2", type: "Flower", sqFoot: 650 },
    { name: "Veg Room", type: "Veg", sqFoot: 450 },
    { name: "Clone Room", type: "Clone", sqFoot: 260 },
    { name: "Mom Room", type: "Mom", sqFoot: 320 },
    { name: "Dry Room 1", type: "Drying", sqFoot: 420 },
    { name: "Dry Room 2", type: "Drying", sqFoot: 420 },
  ];

  const allRooms = await Room.create([
    ...mooseRoomsSpec.map((room) => ({
      ...room,
      locationId: mooseLocation._id,
      batchId: null,
    })),
    ...ironRoomsSpec.map((room) => ({
      ...room,
      locationId: ironLocation._id,
      batchId: null,
    })),
  ]);

  const roomsByLocation = {
    [String(mooseLocation._id)]: allRooms.filter(
      (room) => String(room.locationId) === String(mooseLocation._id),
    ),
    [String(ironLocation._id)]: allRooms.filter(
      (room) => String(room.locationId) === String(ironLocation._id),
    ),
  };

  const mooseFlowerRooms = roomsByLocation[String(mooseLocation._id)].filter(
    (room) => room.type === "Flower" && ["A", "B", "C"].includes(room.name),
  );
  const ironFlowerRoomsABC = roomsByLocation[String(ironLocation._id)].filter(
    (room) => room.type === "Flower" && ["A", "B", "C"].includes(room.name),
  );
  const ironFlowerRoomsA2C2 = roomsByLocation[String(ironLocation._id)].filter(
    (room) => room.type === "Flower" && ["A2", "B2", "C2"].includes(room.name),
  );

  const cloneRooms = {
    [String(mooseLocation._id)]: roomsByLocation[
      String(mooseLocation._id)
    ].find((room) => room.type === "Clone"),
    [String(ironLocation._id)]: roomsByLocation[String(ironLocation._id)].find(
      (room) => room.type === "Clone",
    ),
  };

  const vegRooms = {
    [String(mooseLocation._id)]: roomsByLocation[
      String(mooseLocation._id)
    ].find((room) => room.type === "Veg"),
    [String(ironLocation._id)]: roomsByLocation[String(ironLocation._id)].find(
      (room) => room.type === "Veg",
    ),
  };

  const momRooms = {
    [String(mooseLocation._id)]: roomsByLocation[
      String(mooseLocation._id)
    ].find((room) => room.type === "Mom"),
    [String(ironLocation._id)]: roomsByLocation[String(ironLocation._id)].find(
      (room) => room.type === "Mom",
    ),
  };

  const dryingRooms = {
    [String(mooseLocation._id)]: roomsByLocation[
      String(mooseLocation._id)
    ].filter((room) => room.type === "Drying"),
    [String(ironLocation._id)]: roomsByLocation[
      String(ironLocation._id)
    ].filter((room) => room.type === "Drying"),
  };

  // 5) Build Monday schedule with both past and future entries.
  const nextMonday = getNextMonday(now);
  const pastCount = TOTAL_HARVESTS - FUTURE_HARVESTS;

  const harvestSlots = [];
  for (let i = 0; i < TOTAL_HARVESTS; i += 1) {
    const weeksFromNextMonday = i - (pastCount - 1);
    harvestSlots.push({
      harvestDate: addDays(nextMonday, weeksFromNextMonday * 7),
      // Alternate every week between Moose and Iron.
      locationKey: i % 2 === 0 ? "ML" : "IG",
      slotIndex: i,
    });
  }

  // 6) Create batches + harvests to match each slot.
  let mlCounter = 1;
  let igCounter = 1;

  const createdBatchIds = [];
  const createdHarvestIds = [];

  for (const slot of harvestSlots) {
    const isMoose = slot.locationKey === "ML";
    const locationId = isMoose ? mooseLocation._id : ironLocation._id;
    const numberCounter = isMoose ? mlCounter : igCounter;

    if (isMoose) mlCounter += 1;
    else igCounter += 1;

    const code = `${slot.locationKey}-${pad3(numberCounter)}`;

    // 8 unique strains per harvest.
    const chosenStrains = pickEightUnique(
      strains,
      (slot.slotIndex * 3) % strains.length,
    );

    const targetPlants = isMoose ? randInt(470, 530) : randInt(280, 320);
    const flowerPlants = Math.max(1, targetPlants - MOM_PLANTS_PER_BATCH);
    const momRoom = momRooms[String(locationId)];
    const momStrains = chosenStrains.slice(0, 2);
    const momCounts = allocateCounts(MOM_PLANTS_PER_BATCH, momStrains.length);

    let roomEntries = [];

    if (isMoose) {
      // Moose Lodge harvest uses exactly 1 flower room.
      const room = mooseFlowerRooms[slot.slotIndex % mooseFlowerRooms.length];
      const counts = allocateCounts(flowerPlants, 8);

      const strainEntries = chosenStrains.map((strain, idx) => {
        const plantCount = counts[idx];
        const isFuture = slot.harvestDate > now;

        if (isFuture) {
          return {
            strainId: strain._id,
            plantCount,
            totes: [],
            totalDryWeightGrams: 0,
          };
        }

        const wetPerPlant = randInt(140, 190);
        const totalWet = plantCount * wetPerPlant;
        const dryPct = randInt(24, 26) / 100;
        const totalDry = Math.round(totalWet * dryPct);
        const toteCount = randInt(2, 4);

        return {
          strainId: strain._id,
          plantCount,
          totes: splitIntoTotes(totalWet, toteCount),
          totalDryWeightGrams: totalDry,
        };
      });

      roomEntries = [{ roomId: room._id, strains: strainEntries }];
    } else {
      // Iron Gate harvest uses exactly 2 flower rooms:
      // one from A/B/C and one from A2/B2/C2.
      const pairIdx = slot.slotIndex % 3;
      const roomPrimary = ironFlowerRoomsABC[pairIdx];
      const roomSecondary = ironFlowerRoomsA2C2[pairIdx];

      // Split 8 strains across 2 rooms: 4 + 4 (still 8 total per harvest).
      const counts = allocateCounts(flowerPlants, 8);
      const primaryStrains = chosenStrains.slice(0, 4);
      const secondaryStrains = chosenStrains.slice(4, 8);
      const primaryCounts = counts.slice(0, 4);
      const secondaryCounts = counts.slice(4, 8);

      const makeStrainEntries = (strainList, countList) =>
        strainList.map((strain, idx) => {
          const plantCount = countList[idx];
          const isFuture = slot.harvestDate > now;

          if (isFuture) {
            return {
              strainId: strain._id,
              plantCount,
              totes: [],
              totalDryWeightGrams: 0,
            };
          }

          const wetPerPlant = randInt(140, 190);
          const totalWet = plantCount * wetPerPlant;
          const dryPct = randInt(24, 26) / 100;
          const totalDry = Math.round(totalWet * dryPct);
          const toteCount = randInt(2, 4);

          return {
            strainId: strain._id,
            plantCount,
            totes: splitIntoTotes(totalWet, toteCount),
            totalDryWeightGrams: totalDry,
          };
        });

      roomEntries = [
        {
          roomId: roomPrimary._id,
          strains: makeStrainEntries(primaryStrains, primaryCounts),
        },
        {
          roomId: roomSecondary._id,
          strains: makeStrainEntries(secondaryStrains, secondaryCounts),
        },
      ];
    }

    // Batch lifecycle: 12 weeks total = 84 days before harvest date.
    const cloneDate = addDays(slot.harvestDate, -84);
    const lifecycle = deriveLifecycle(cloneDate, slot.harvestDate, now);
    const batchRooms = roomEntries.map((entry) => ({
      roomId: entry.roomId,
      plants: entry.strains.map((s) => ({
        strainId: s.strainId,
        count: s.plantCount,
      })),
    }));

    if (momRoom && momStrains.length > 0) {
      batchRooms.push({
        roomId: momRoom._id,
        plants: momStrains.map((strain, idx) => ({
          strainId: strain._id,
          count: momCounts[idx] || 0,
        })),
      });
    }

    const batch = await Batch.create({
      batchNumber: code,
      cloneDate,
      harvestDate: slot.harvestDate,
      location: locationId,
      rooms: batchRooms,
      lifecycleStage: lifecycle.stage,
      stageStartedAt: lifecycle.stageStartedAt,
      nextTransitionAt: lifecycle.nextTransitionAt,
      createdAt: cloneDate,
    });

    const harvest = await Harvest.create({
      harvestNumber: code,
      batchId: batch._id,
      locationId,
      rooms: roomEntries,
      harvestDate: slot.harvestDate,
      createdAt: slot.harvestDate,
    });

    // Past/current harvests are already harvested and linked.
    if (slot.harvestDate <= now) {
      await Batch.findByIdAndUpdate(batch._id, { harvestId: harvest._id });

      const dryingRoomPool = dryingRooms[String(locationId)];
      const dryingRoom = dryingRoomPool[slot.slotIndex % dryingRoomPool.length];
      const drySnapshotDate =
        now < addDays(slot.harvestDate, DRYING_DAYS)
          ? now
          : addDays(slot.harvestDate, DRYING_DAYS);
      const hoursDrying = Math.max(
        0,
        Math.round((drySnapshotDate - slot.harvestDate) / 3600000),
      );

      const dryRoomDocs = roomEntries.flatMap((roomEntry) =>
        roomEntry.strains.map((strainEntry) => ({
          strainId: strainEntry.strainId,
          harvestId: harvest._id,
          roomId: dryingRoom._id,
          totalRacks: randInt(10, 18),
          totalRacksUsed: randInt(1, 4),
          strainCount: strainEntry.plantCount,
          date: drySnapshotDate,
          timeElapsedHours: hoursDrying,
        })),
      );

      if (dryRoomDocs.length > 0) {
        await DryRoomData.insertMany(dryRoomDocs);
      }
    }

    // Optional "current occupancy" for room.batchId based on lifecycle today.
    // If multiple active batches target same room, latest assignment wins.
    if (lifecycle.occupancy === "clone") {
      const cloneRoom = cloneRooms[String(locationId)];
      if (cloneRoom) {
        await Room.findByIdAndUpdate(cloneRoom._id, { batchId: batch._id });
      }
    }

    if (lifecycle.occupancy === "veg") {
      const vegRoom = vegRooms[String(locationId)];
      if (vegRoom) {
        await Room.findByIdAndUpdate(vegRoom._id, { batchId: batch._id });
      }
    }

    if (lifecycle.occupancy === "flower") {
      await Room.updateMany(
        { _id: { $in: batchRooms.map((entry) => entry.roomId) } },
        { $set: { batchId: batch._id } },
      );
    }

    if (lifecycle.occupancy === "drying") {
      const dryingRoomPool = dryingRooms[String(locationId)];
      const dryingRoom = dryingRoomPool[slot.slotIndex % dryingRoomPool.length];
      if (dryingRoom) {
        await Room.findByIdAndUpdate(dryingRoom._id, { batchId: batch._id });
      }
    }

    createdBatchIds.push(batch._id);
    createdHarvestIds.push(harvest._id);
  }

  // 7) Sanity summary for quick verification.
  const [
    companiesCount,
    locationsCount,
    roomsCount,
    batchesCount,
    harvestsCount,
    dryCount,
  ] = await Promise.all([
    Company.countDocuments(),
    Location.countDocuments(),
    Room.countDocuments(),
    Batch.countDocuments(),
    Harvest.countDocuments(),
    DryRoomData.countDocuments(),
  ]);

  const futureHarvestCount = await Harvest.countDocuments({
    harvestDate: { $gt: now },
  });
  const pastHarvestCount = await Harvest.countDocuments({
    harvestDate: { $lte: now },
  });
  const lifecycleBreakdown = await Batch.aggregate([
    {
      $group: {
        _id: "$lifecycleStage",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const locationHarvestBreakdown = await Harvest.aggregate([
    {
      $group: {
        _id: "$locationId",
        count: { $sum: 1 },
      },
    },
  ]);

  const locationsById = new Map([
    [String(mooseLocation._id), MOOSE_LOCATION],
    [String(ironLocation._id), IRON_LOCATION],
  ]);

  console.log("RESEED_COMPLETE");
  console.log(
    JSON.stringify(
      {
        keptStrains: strains.length,
        companiesCount,
        locationsCount,
        roomsCount,
        batchesCount,
        harvestsCount,
        dryRoomDataCount: dryCount,
        pastHarvestCount,
        futureHarvestCount,
        lifecycleBreakdown,
        harvestsByLocation: locationHarvestBreakdown.map((row) => ({
          location: locationsById.get(String(row._id)) || String(row._id),
          count: row.count,
        })),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("RESEED_FAILED", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors on failure path
  }
  process.exit(1);
});
