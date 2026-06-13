const Room = require("../models/Room");

// Convert unknown input to a safe number.
const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

// Average weight per plant.
const averagePerPlant = (weight, plantCount) => {
  if (plantCount <= 0) {
    return null;
  }
  return weight / plantCount;
};

// Percent change from wet to dry weight.
const percentChangeWetToDry = (wetWeight, dryWeight) => {
  if (wetWeight <= 0) {
    return null;
  }
  return ((dryWeight - wetWeight) / wetWeight) * 100;
};

// Yield formula for one strain entry.
const justinYieldForStrain = ({
  strainPlantCount,
  totalPlantCount,
  totalRoomSquareFeet,
  dryWeight,
}) => {
  if (totalPlantCount <= 0 || totalRoomSquareFeet <= 0) {
    return null;
  }

  const x = strainPlantCount / totalPlantCount;
  const y = x * totalRoomSquareFeet;

  if (y <= 0) {
    return null;
  }

  return dryWeight / y;
};

// Sum square footage for all selected rooms.
const getTotalRoomSquareFeet = async (rooms) => {
  const roomIds = Array.isArray(rooms)
    ? rooms.map((entry) => entry?.roomId).filter(Boolean)
    : [];

  if (roomIds.length === 0) {
    return 0;
  }

  const roomDocs = await Room.find({ _id: { $in: roomIds } }).select("sqFoot");
  return roomDocs.reduce(
    (sum, roomDoc) => sum + toNumber(roomDoc.sqFoot, 0),
    0,
  );
};

// Recalculate all derived harvest fields before save.
const applyHarvestCalculations = async (harvestDoc) => {
  // 1) Load total room size.
  const rooms = Array.isArray(harvestDoc.rooms) ? harvestDoc.rooms : [];
  const totalRoomSquareFeet = await getTotalRoomSquareFeet(rooms);

  // 2) Flatten room strains for harvest-level totals.
  const allStrains = rooms.flatMap((roomEntry) =>
    Array.isArray(roomEntry?.strains) ? roomEntry.strains : [],
  );

  // 3) Total plant count across all rooms.
  harvestDoc.totalPlantCount = allStrains.reduce(
    (sum, strain) => sum + toNumber(strain.plantCount, 0),
    0,
  );

  let totalWetWeightGrams = 0;
  let totalDryWeightGrams = 0;

  // 4) Recompute each strain's derived fields.
  rooms.forEach((roomEntry) => {
    const roomStrains = Array.isArray(roomEntry?.strains)
      ? roomEntry.strains
      : [];

    roomStrains.forEach((strain) => {
      // Parse input values.
      const plantCount = toNumber(strain.plantCount, 0);
      const wetWeight = Array.isArray(strain.totes)
        ? strain.totes.reduce(
            (sum, tote) => sum + toNumber(tote?.wetWeight, 0),
            0,
          )
        : 0;
      const dryWeight = toNumber(strain.totalDryWeightGrams, 0);

      // Save per-strain calculations.
      strain.totalWetWeightGrams = wetWeight;
      strain.totalDryWeightGrams = dryWeight;
      strain.wetPlantAvgWeightGrams = averagePerPlant(wetWeight, plantCount);
      strain.dryPlantAvgWeightGrams = averagePerPlant(dryWeight, plantCount);
      strain.percentChangeWetToDry = percentChangeWetToDry(
        wetWeight,
        dryWeight,
      );
      strain.yieldGramsPerSquareFoot = justinYieldForStrain({
        strainPlantCount: plantCount,
        totalPlantCount: harvestDoc.totalPlantCount,
        totalRoomSquareFeet,
        dryWeight,
      });

      // Add to harvest totals.
      totalWetWeightGrams += wetWeight;
      totalDryWeightGrams += dryWeight;
    });
  });

  // 5) Save final harvest totals.
  harvestDoc.totalWetWeightGrams = totalWetWeightGrams;
  harvestDoc.totalDryWeightGrams = totalDryWeightGrams;
  harvestDoc.totalPercentChangeWetToDry = percentChangeWetToDry(
    totalWetWeightGrams,
    totalDryWeightGrams,
  );
  harvestDoc.totalYieldGramsPerSquareFoot =
    totalRoomSquareFeet > 0 ? totalDryWeightGrams / totalRoomSquareFeet : null;
};

module.exports = {
  applyHarvestCalculations,
};
