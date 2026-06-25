/**
 * Strain viewer calculations — expected yield and historical averages.
 */

// Historical average dry grams per plant from harvest records for one strain.
function getHistoricalAvgDryPerPlant({
  totalDryWeightGrams = 0,
  totalHarvestPlantCount = 0,
} = {}) {
  if (totalHarvestPlantCount <= 0) return null;
  return totalDryWeightGrams / totalHarvestPlantCount;
}

// Best available avg dry g/plant: harvest history first, then strain profile field.
export function resolveAvgDryPerPlant(strain, harvestStats) {
  const historical = getHistoricalAvgDryPerPlant(harvestStats);
  if (historical !== null && historical > 0) return historical;

  const profileAvg = Number(strain?.avgWeightPerPlant);
  if (Number.isFinite(profileAvg) && profileAvg > 0) return profileAvg;

  return null;
}

// Expected dry yield for a placement row. Mom batches do not get a forecast.
export function getExpectedYieldGrams({
  plantCount = 0,
  avgDryPerPlant = null,
  batchType = "production",
} = {}) {
  if (batchType === "mom") return null;
  if (!avgDryPerPlant || plantCount <= 0) return null;
  return Math.round(plantCount * avgDryPerPlant);
}

function isSameCalendarDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Sum expected dry yield only for placements tied to the strain's next harvest date.
export function getNextHarvestExpectedYieldGrams(placements, nextHarvestDate) {
  if (!nextHarvestDate || !Array.isArray(placements)) return null;

  const total = placements.reduce((sum, placement) => {
    if (!isSameCalendarDay(placement.batchHarvestDate, nextHarvestDate)) {
      return sum;
    }
    return sum + (placement.expectedYieldGrams || 0);
  }, 0);

  return total > 0 ? total : null;
}

export function formatGrams(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value).toLocaleString()} g`;
}

export function formatAvgGrams(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} g`;
}
