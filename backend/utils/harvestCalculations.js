/**
 * Harvest math — wet/dry weights, averages, and yield per square foot.
 */

const Room = require("../models/Room");

// Safely converts a value to a number, or returns a fallback.
const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

// Divides weight by plant count to get average grams per plant.
const averagePerPlant = (weight, plantCount) => {
  if (plantCount <= 0) {
    return null;
  }
  return weight / plantCount;
};

// Calculates percent change from wet weight to dry weight.
const percentChangeWetToDry = (wetWeight, dryWeight) => {
  if (wetWeight <= 0) {
    return null;
  }
  return ((dryWeight - wetWeight) / wetWeight) * 100;
};

// Yield formula: dry grams per square foot for one strain in the harvest.
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

// Adds up square footage for all rooms in a harvest.
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

// Recalculates all computed fields on a harvest document before it is saved.
const applyHarvestCalculations = async (harvestDoc) => {
  const rooms = Array.isArray(harvestDoc.rooms) ? harvestDoc.rooms : [];
  const totalRoomSquareFeet = await getTotalRoomSquareFeet(rooms);

  const allStrains = rooms.flatMap((roomEntry) =>
    Array.isArray(roomEntry?.strains) ? roomEntry.strains : [],
  );

  harvestDoc.totalPlantCount = allStrains.reduce(
    (sum, strain) => sum + toNumber(strain.plantCount, 0),
    0,
  );

  let totalWetWeightGrams = 0;
  let totalDryWeightGrams = 0;

  rooms.forEach((roomEntry) => {
    const roomStrains = Array.isArray(roomEntry?.strains)
      ? roomEntry.strains
      : [];

    roomStrains.forEach((strain) => {
      const plantCount = toNumber(strain.plantCount, 0);
      const wetWeight = Array.isArray(strain.totes)
        ? strain.totes.reduce(
            (sum, tote) => sum + toNumber(tote?.wetWeight, 0),
            0,
          )
        : 0;
      const dryWeight = toNumber(strain.totalDryWeightGrams, 0);

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

      totalWetWeightGrams += wetWeight;
      totalDryWeightGrams += dryWeight;
    });
  });

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
