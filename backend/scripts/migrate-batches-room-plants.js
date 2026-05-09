require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

function toIdString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && value.toString)
    return value.toString();
  return "";
}

function isNewRoomsShape(rooms) {
  if (!Array.isArray(rooms)) return false;
  return rooms.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      entry.roomId &&
      Array.isArray(entry.plants),
  );
}

function normalizeOldPlants(oldPlants) {
  if (!Array.isArray(oldPlants)) return [];
  return oldPlants
    .filter((p) => p && p.strainId)
    .map((p) => ({
      strainId: p.strainId,
      count: Number(p.count) || 0,
    }));
}

function buildFromHarvestRooms(harvestRooms) {
  if (!Array.isArray(harvestRooms)) return null;

  const migrated = harvestRooms
    .filter((r) => r && r.roomId)
    .map((r) => ({
      roomId: r.roomId,
      plants: Array.isArray(r.strains)
        ? r.strains
            .filter((s) => s && s.strainId)
            .map((s) => ({
              strainId: s.strainId,
              count: Number(s.plantCount) || 0,
            }))
        : [],
    }));

  return migrated.length > 0 ? migrated : null;
}

function buildFallbackFromBatch(oldRooms, oldPlants) {
  const roomIds = Array.isArray(oldRooms)
    ? oldRooms.filter((r) => r && !(r.roomId && Array.isArray(r.plants)))
    : [];

  if (roomIds.length === 0) return [];

  return roomIds.map((roomId, index) => ({
    roomId,
    plants: index === 0 ? normalizeOldPlants(oldPlants) : [],
  }));
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  const batchesCollection = mongoose.connection.collection("batches");
  const harvestsCollection = mongoose.connection.collection("harvests");

  const batches = await batchesCollection.find({}).toArray();

  let skipped = 0;
  let migrated = 0;
  let harvestMapped = 0;
  let fallbackMapped = 0;

  for (const batch of batches) {
    const rooms = Array.isArray(batch.rooms) ? batch.rooms : [];
    const oldPlants = Array.isArray(batch.plants) ? batch.plants : [];

    const alreadyNew =
      isNewRoomsShape(rooms) && !Object.hasOwn(batch, "plants");
    if (alreadyNew) {
      skipped += 1;
      continue;
    }

    let newRooms = null;

    const harvest = await harvestsCollection.findOne({ batchId: batch._id });
    if (harvest && Array.isArray(harvest.rooms) && harvest.rooms.length > 0) {
      newRooms = buildFromHarvestRooms(harvest.rooms);
    }

    if (newRooms && newRooms.length > 0) {
      harvestMapped += 1;
    } else {
      newRooms = buildFallbackFromBatch(rooms, oldPlants);
      fallbackMapped += 1;
    }

    await batchesCollection.updateOne(
      { _id: batch._id },
      {
        $set: { rooms: newRooms },
        $unset: { plants: "" },
      },
    );

    migrated += 1;
    console.log(
      `Migrated ${batch.batchNumber || toIdString(batch._id)} -> ${newRooms.length} room entries`,
    );
  }

  console.log("\nMigration complete.");
  console.log(`Total batches: ${batches.length}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already new): ${skipped}`);
  console.log(`Mapped from harvest.rooms: ${harvestMapped}`);
  console.log(`Mapped via fallback: ${fallbackMapped}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors on failure path
  }
  process.exit(1);
});
