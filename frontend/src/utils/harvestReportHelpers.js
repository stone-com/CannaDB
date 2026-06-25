/**
 * Harvest report formatting helpers.
 */

export function roundToTenth(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 10) / 10;
}

export function formatHarvestMetric(value) {
  if (value === null || value === undefined || value === "N/A") return "—";
  if (typeof value === "string" && value.trim() === "") return "—";

  const rounded = roundToTenth(value);
  if (rounded === null) return String(value);

  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatHarvestPercent(value) {
  const formatted = formatHarvestMetric(value);
  return formatted === "—" ? formatted : `${formatted}%`;
}

export function formatToteWeights(totes) {
  if (!Array.isArray(totes) || totes.length === 0) return "None";
  return totes.map((tote) => formatHarvestMetric(tote?.wetWeight ?? 0)).join(", ");
}

export function buildHarvestListLabel(harvest, formatDate) {
  if (!harvest) return "—";

  const dateText = formatDate(harvest.harvestDate);
  const harvestNumberText = harvest.harvestNumber || "No number";
  const locationText = harvest.locationId?.nickname || "No location";

  return `${dateText} · ${harvestNumberText} · ${locationText}`;
}

export function buildHarvestSearchText(harvest, formatDate) {
  const rooms = Array.isArray(harvest?.rooms) ? harvest.rooms : [];
  const roomNames = rooms
    .map((roomEntry) => roomEntry?.roomId?.name)
    .filter(Boolean)
    .join(" ");

  return [
    harvest?.harvestNumber,
    harvest?.locationId?.nickname,
    formatDate(harvest?.harvestDate),
    roomNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterHarvests(harvests, query, formatDate) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return harvests;

  return harvests.filter((harvest) =>
    buildHarvestSearchText(harvest, formatDate).includes(normalizedQuery),
  );
}

export function sortHarvests(harvests, sortBy = "date-desc") {
  const list = Array.isArray(harvests) ? [...harvests] : [];

  switch (sortBy) {
    case "date-asc":
      return list.sort((a, b) => new Date(a.harvestDate) - new Date(b.harvestDate));
    case "location-asc":
      return list.sort(
        (a, b) =>
          (a.locationId?.nickname || "").localeCompare(b.locationId?.nickname || "") ||
          new Date(b.harvestDate) - new Date(a.harvestDate),
      );
    case "dry-desc":
      return list.sort(
        (a, b) =>
          (Number(b.totalDryWeightGrams) || 0) - (Number(a.totalDryWeightGrams) || 0) ||
          new Date(b.harvestDate) - new Date(a.harvestDate),
      );
    case "date-desc":
    default:
      return list.sort((a, b) => new Date(b.harvestDate) - new Date(a.harvestDate));
  }
}
