const Room = require("../models/Room");

// Helper: safely converts values into numbers.
// Useful when form payloads send strings like "12" instead of number 12.
const toNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

// Helper: average weight per plant.
// Returns null when plantCount is 0 to avoid divide-by-zero.
const averagePerPlant = (weight, plantCount) => {
  if (plantCount <= 0) {
    return null;
  }
  return weight / plantCount;
};

// Helper: percent change from wet -> dry.
// Formula: ((dry - wet) / wet) * 100
const percentChangeWetToDry = (wetWeight, dryWeight) => {
  if (wetWeight <= 0) {
    return null;
  }
  return ((dryWeight - wetWeight) / wetWeight) * 100;
};

// Helper: Justin's yield formula for one strain entry.
// x = strainPlantCount / totalPlantCount
// y = x * totalRoomSquareFeet
// yield = dryWeight / y
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

// Fetches all referenced rooms and sums up square footage.
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

// Main function to apply all harvest calculations and update the document accordingly
// Recalculates every derived field on a Harvest document.
// This function mutates the incoming Mongoose document directly.
// Imported into the harvest Model and called in a pre-validation hook to ensure all calculations run before saving.
const applyHarvestCalculations = async (harvestDoc) => {
  // 1) Get total square footage from all referenced rooms.
  const rooms = Array.isArray(harvestDoc.rooms) ? harvestDoc.rooms : [];
  const totalRoomSquareFeet = await getTotalRoomSquareFeet(rooms);

  // 2) Flatten all nested room strains into one list for harvest-level totals.
  const allStrains = rooms.flatMap((roomEntry) =>
    Array.isArray(roomEntry?.strains) ? roomEntry.strains : [],
  );

  // 3) Harvest total plants = sum of strain plantCount across all rooms.
  harvestDoc.totalPlantCount = allStrains.reduce(
    (sum, strain) => sum + toNumber(strain.plantCount, 0),
    0,
  );

  let totalWetWeightGrams = 0;
  let totalDryWeightGrams = 0;

  // 4) Recompute all per-strain derived values.
  rooms.forEach((roomEntry) => {
    const roomStrains = Array.isArray(roomEntry?.strains)
      ? roomEntry.strains
      : [];

    roomStrains.forEach((strain) => {
      // Parse raw input values.
      const plantCount = toNumber(strain.plantCount, 0);
      const wetWeight = Array.isArray(strain.totes)
        ? strain.totes.reduce(
            (sum, tote) => sum + toNumber(tote?.wetWeight, 0),
            0,
          )
        : 0;
      const dryWeight = toNumber(strain.totalDryWeightGrams, 0);

      // Set per-strain formulas.
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

      // Build harvest-level totals while iterating.
      totalWetWeightGrams += wetWeight;
      totalDryWeightGrams += dryWeight;
    });
  });

  // 5) Save final harvest-level totals + formulas.
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
  averagePerPlant,
  percentChangeWetToDry,
  justinYieldForStrain,
  getTotalRoomSquareFeet,
};
