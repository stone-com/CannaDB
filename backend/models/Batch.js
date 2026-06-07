const mongoose = require("mongoose");

// A batch is one tracked plant group over time.
const batchSchema = new mongoose.Schema({
  batchNumber: {
    type: String,
    required: true,
    unique: true,
  },
  // Set after harvest is created.
  harvestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Harvest",
    default: null,
  },
  cloneDate: {
    type: Date,
    required: true,
  },
  harvestDate: {
    type: Date,
    default: null,
  },
  batchType: {
    type: String,
    enum: ["production", "mom"],
    default: "production",
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Location",
    default: null,
  },
  // Planned plants per room.
  // Current live occupancy is stored in RoomAssignment.
  rooms: [
    {
      roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true,
      },
      plants: [
        {
          strainId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Strain",
            required: true,
          },
          count: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
          },
        },
      ],
    },
  ],
  lifecycleStage: {
    type: String,
    enum: [
      "Clone",
      "Veg",
      "Flower",
      "Mom",
      "HarvestReady",
      "Drying",
      "Completed",
    ],
    default: "Clone",
  },
  stageStartedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

batchSchema.index({ lifecycleStage: 1, batchType: 1, harvestDate: 1 });
batchSchema.index({ location: 1, lifecycleStage: 1, createdAt: -1 });

function normalizeObjectId(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    if (value._id) {
      return String(value._id);
    }

    if (typeof value.toString === "function") {
      return String(value);
    }
  }

  return String(value);
}

function getBatchCompletionState(batchLike) {
  return String(
    batchLike?.currentStage ??
      batchLike?.stage ??
      batchLike?.lifecycleStage ??
      batchLike?.status ??
      ""
  ).toLowerCase();
}

function isCompletedBatch(batchLike) {
  const state = getBatchCompletionState(batchLike);
  return state === "completed" || state === "complete";
}

function getHarvestDryWeightTotal(harvest) {
  const directValue = [
    harvest?.totalDryWeight,
    harvest?.totalDryweight,
    harvest?.finalDryWeight,
    harvest?.finalDryweight,
    harvest?.dryWeight,
    harvest?.dryweight,
  ].find((value) => Number.isFinite(Number(value)) && Number(value) > 0);

  if (directValue !== undefined) {
    return Number(directValue);
  }

  if (!Array.isArray(harvest?.dryWeights)) {
    return null;
  }

  const total = harvest.dryWeights.reduce((sum, entry) => {
    const numericValue = Number(
      entry?.dryWeight ??
        entry?.dryweight ??
        entry?.weight ??
        entry?.amount ??
        entry?.value ??
        0
    );

    return Number.isFinite(numericValue) ? sum + numericValue : sum;
  }, 0);

  return total > 0 ? total : null;
}

async function recalculateStrainAverageDryWeights() {
  const Harvest = mongoose.models.Harvest || require("./Harvest");
  const Strain = mongoose.models.Strain || require("./Strain");
  const BatchModel = mongoose.models.Batch;

  const completedBatches = await BatchModel.find({
    $or: [
      { currentStage: { $in: ["Completed", "Complete"] } },
      { stage: { $in: ["Completed", "Complete"] } },
      { lifecycleStage: { $in: ["Completed", "Complete"] } },
      { status: { $in: ["Completed", "Complete"] } },
    ],
  })
    .select("_id strain strainId strainName name")
    .lean();

  const strains = await Strain.find({}).select("_id name").lean();

  if (!strains.length) {
    return;
  }

  const strainNameToId = new Map(
    strains
      .filter((strain) => strain?.name)
      .map((strain) => [String(strain.name).toLowerCase(), String(strain._id)])
  );

  const batchToStrainId = new Map();
  for (const batch of completedBatches) {
    const batchId = normalizeObjectId(batch?._id);
    if (!batchId) {
      continue;
    }

    const directStrainId = normalizeObjectId(batch?.strain ?? batch?.strainId);
    const namedStrainId = batch?.strainName
      ? strainNameToId.get(String(batch.strainName).toLowerCase())
      : batch?.name
        ? strainNameToId.get(String(batch.name).toLowerCase())
        : null;

    if (directStrainId || namedStrainId) {
      batchToStrainId.set(batchId, directStrainId || namedStrainId);
    }
  }

  const completedBatchIds = Array.from(batchToStrainId.keys());
  const averagesByStrainId = new Map(
    strains.map((strain) => [String(strain._id), []])
  );

  if (completedBatchIds.length) {
    const harvests = await Harvest.find({
      $or: [
        { sourceBatch: { $in: completedBatchIds } },
        { batch: { $in: completedBatchIds } },
        { batchId: { $in: completedBatchIds } },
      ],
    }).lean();

    for (const harvest of harvests) {
      const linkedBatchId =
        normalizeObjectId(harvest?.sourceBatch) ||
        normalizeObjectId(harvest?.batch) ||
        normalizeObjectId(harvest?.batchId);

      const directStrainId =
        normalizeObjectId(harvest?.strain) ||
        normalizeObjectId(harvest?.strainId) ||
        (harvest?.strainName
          ? strainNameToId.get(String(harvest.strainName).toLowerCase())
          : null);

      const strainId = directStrainId || batchToStrainId.get(linkedBatchId);
      const dryWeightTotal = getHarvestDryWeightTotal(harvest);

      if (!strainId || dryWeightTotal == null || dryWeightTotal <= 0) {
        continue;
      }

      if (!averagesByStrainId.has(strainId)) {
        averagesByStrainId.set(strainId, []);
      }

      averagesByStrainId.get(strainId).push(dryWeightTotal);
    }
  }

  const bulkUpdates = strains.map((strain) => {
    const strainId = String(strain._id);
    const values = averagesByStrainId.get(strainId) || [];
    const average = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;

    return {
      updateOne: {
        filter: { _id: strain._id },
        update: {
          $set: {
            avgdryweight: average,
            avgDryWeight: average,
          },
        },
      },
    };
  });

  if (bulkUpdates.length) {
    await Strain.bulkWrite(bulkUpdates);
  }
}

function triggerStrainAverageRefresh(batchLike) {
  if (!isCompletedBatch(batchLike)) {
    return;
  }

  void recalculateStrainAverageDryWeights().catch((error) => {
    console.error("Failed to recalculate strain average dry weights", error);
  });
}

batchSchema.post("save", function onBatchSave(doc) {
  triggerStrainAverageRefresh(doc);
});

batchSchema.post("findOneAndUpdate", function onBatchUpdate(doc) {
  triggerStrainAverageRefresh(doc);
});

module.exports = mongoose.model("Batch", batchSchema);
