require("dotenv").config();
const mongoose = require("mongoose");
const Batch = require("../models/Batch");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

const STAGE_DAYS = {
  Clone: 16,
  Veg: 13,
  Flower: 54,
};

function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * 86400000);
}

function deriveLifecycle(cloneDate) {
  const now = new Date();
  const clone = new Date(cloneDate);

  const vegStart = addDays(clone, STAGE_DAYS.Clone);
  const flowerStart = addDays(vegStart, STAGE_DAYS.Veg);
  const harvestReadyStart = addDays(flowerStart, STAGE_DAYS.Flower);

  if (now < vegStart) {
    return {
      lifecycleStage: "Clone",
      stageStartedAt: clone,
      nextTransitionAt: vegStart,
    };
  } else if (now < flowerStart) {
    return {
      lifecycleStage: "Veg",
      stageStartedAt: vegStart,
      nextTransitionAt: flowerStart,
    };
  } else if (now < harvestReadyStart) {
    return {
      lifecycleStage: "Flower",
      stageStartedAt: flowerStart,
      nextTransitionAt: harvestReadyStart,
    };
  } else {
    return {
      lifecycleStage: "HarvestReady",
      stageStartedAt: harvestReadyStart,
      nextTransitionAt: null,
    };
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const batches = await Batch.find({});
  console.log(`Found ${batches.length} batches to update`);

  let updated = 0;
  for (const batch of batches) {
    if (!batch.cloneDate) {
      console.warn(`  Skipping batch ${batch.batchNumber} — no cloneDate`);
      continue;
    }

    const lifecycle = deriveLifecycle(batch.cloneDate);
    batch.lifecycleStage = lifecycle.lifecycleStage;
    batch.stageStartedAt = lifecycle.stageStartedAt;
    batch.nextTransitionAt = lifecycle.nextTransitionAt;
    await batch.save();
    updated++;
    console.log(
      `  ${batch.batchNumber}: ${lifecycle.lifecycleStage} (started ${lifecycle.stageStartedAt.toDateString()})`,
    );
  }

  console.log(`\nDone. Updated ${updated} batches.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
