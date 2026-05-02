const cron = require("node-cron");
const Batch = require("../models/Batch");
const Room = require("../models/Room");

const NEXT_STAGE = {
  Clone: "Veg",
  Veg: "Flower",
  Flower: "HarvestReady",
};

const STAGE_DAYS = {
  Clone: 16,
  Veg: 13,
  Flower: 54,
};

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

async function runLifecycleTick() {
  const now = new Date();
  const activeLifecycleStages = Object.keys(NEXT_STAGE);

  const dueBatches = await Batch.find({
    lifecycleStage: { $in: activeLifecycleStages },
    nextTransitionAt: { $lte: now },
  });

  for (const batch of dueBatches) {
    const nextStage = NEXT_STAGE[batch.lifecycleStage];
    if (!nextStage) continue;

    // Clear old room assignments for this batch.
    await Room.updateMany({ batchId: batch._id }, { $set: { batchId: null } });

    let targetRoomIds = [];

    if (nextStage === "Veg") {
      // Clone -> Veg: choose an open Veg room at the batch's location.
      const vegRoom = await Room.findOne({
        locationId: batch.location,
        type: "Veg",
        batchId: null,
      });
      if (vegRoom) {
        targetRoomIds = [vegRoom._id];
      }
    } else if (nextStage === "Flower") {
      // Veg -> Flower: assign to all rooms listed in batch.rooms.
      targetRoomIds = Array.isArray(batch.rooms)
        ? batch.rooms.map((entry) => entry?.roomId).filter((id) => id != null)
        : [];
    }

    // Only update Room assignment. Do not mutate batch.rooms.
    if (targetRoomIds.length > 0) {
      await Room.updateMany(
        { _id: { $in: targetRoomIds } },
        { $set: { batchId: batch._id } },
      );
    }

    batch.lifecycleStage = nextStage;
    batch.stageStartedAt = now;
    batch.nextTransitionAt = STAGE_DAYS[nextStage]
      ? addDays(now, STAGE_DAYS[nextStage])
      : null;

    await batch.save();
  }
}

function startBatchLifecycleJob() {
  cron.schedule("0 * * * *", async () => {
    try {
      await runLifecycleTick();
    } catch (err) {
      console.error("[lifecycle]", err.message);
    }
  });
}

module.exports = { startBatchLifecycleJob, runLifecycleTick };
