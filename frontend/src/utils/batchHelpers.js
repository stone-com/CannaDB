/**
 * Helpers for reading plant data from batch API responses.
 * Batch.plants is the source of truth for what is in a batch.
 */

function getStrainId(plantEntry) {
  return String(plantEntry?.strainId?._id || plantEntry?.strainId || "");
}

// Returns [{ strainId, strainName, count }] from batch.plants.
export function getBatchStrainTotals(batch) {
  if (!batch) return [];

  const totals = new Map();

  (Array.isArray(batch.plants) ? batch.plants : []).forEach((plantEntry) => {
    const strainId = getStrainId(plantEntry);
    if (!strainId) return;

    const strainName = plantEntry?.strainId?.name || "Unknown Strain";
    const current = totals.get(strainId) || { strainId, strainName, count: 0 };
    current.count += Number(plantEntry?.count) || 0;
    totals.set(strainId, current);
  });

  return Array.from(totals.values()).sort((a, b) =>
    a.strainName.localeCompare(b.strainName),
  );
}

function aggregatePlantsFromRoomEntries(roomEntries) {
  const totals = new Map();

  (Array.isArray(roomEntries) ? roomEntries : []).forEach((roomEntry) => {
    (Array.isArray(roomEntry?.plants) ? roomEntry.plants : []).forEach(
      (plantEntry) => {
        const strainId = getStrainId(plantEntry);
        if (!strainId) return;

        const strainName = plantEntry?.strainId?.name || "Unknown Strain";
        const current = totals.get(strainId) || {
          strainId,
          strainName,
          count: 0,
        };
        current.count += Number(plantEntry?.count) || 0;
        totals.set(strainId, current);
      },
    );
  });

  return Array.from(totals.values()).sort((a, b) =>
    a.strainName.localeCompare(b.strainName),
  );
}

// Prefer room-assignment totals when present; mom cuts come from assigned plants.
export function getAvailableMomCutTotals(batch) {
  if (Array.isArray(batch?.rooms) && batch.rooms.length > 0) {
    return aggregatePlantsFromRoomEntries(batch.rooms);
  }

  return getBatchStrainTotals(batch);
}

// Room names for a batch from active room assignments.
export function getRoomNamesForBatch(batchId, roomAssignments = []) {
  if (!batchId) return [];

  const names = roomAssignments
    .filter(
      (assignment) =>
        assignment?.active !== false &&
        String(assignment?.batchId?._id || assignment?.batchId) ===
          String(batchId),
    )
    .map((assignment) => assignment?.roomId?.name)
    .filter(Boolean);

  return [...new Set(names)];
}
