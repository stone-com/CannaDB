/**
 * Plant count helpers used by batch and room-assignment routes.
 */

// Gets a strain ID string from a plant entry (handles populated or plain IDs).
function getStrainId(plantEntry) {
  if (!plantEntry?.strainId) return null;
  if (typeof plantEntry.strainId === "string") return plantEntry.strainId;
  if (plantEntry.strainId?._id) return String(plantEntry.strainId._id);
  return String(plantEntry.strainId);
}

// Adds up plant counts by strain across all rooms in a batch.
function aggregatePlantTotalsMap(roomEntries) {
  const totals = new Map();

  (Array.isArray(roomEntries) ? roomEntries : []).forEach((roomEntry) => {
    (Array.isArray(roomEntry?.plants) ? roomEntry.plants : []).forEach(
      (plantEntry) => {
        const strainId = getStrainId(plantEntry);
        const count = Number(plantEntry?.count) || 0;
        if (!strainId || count <= 0) return;
        totals.set(strainId, (totals.get(strainId) || 0) + count);
      },
    );
  });

  return totals;
}

// Converts a totals Map into the { strainId, count } array shape used in schemas.
function mapTotalsToPlants(totalsMap) {
  return Array.from(totalsMap.entries()).map(([strainId, count]) => ({
    strainId,
    count,
  }));
}

// Cleans a flat plants array so every entry has a valid strainId and count.
function normalizePlantEntries(plantEntries) {
  return (Array.isArray(plantEntries) ? plantEntries : [])
    .map((plant) => ({
      strainId: getStrainId(plant),
      count: Number(plant?.count) || 0,
    }))
    .filter((plant) => plant.strainId && plant.count > 0);
}

// Turns active room assignments into the same room/plant shape used on batches.
function roomEntriesFromAssignments(assignments) {
  return (Array.isArray(assignments) ? assignments : [])
    .filter((assignment) => assignment?.active !== false)
    .map((assignment) => ({
      roomId: assignment?.roomId?._id || assignment?.roomId,
      plants: normalizePlantEntries(assignment?.assignedPlants),
    }))
    .filter((roomEntry) => roomEntry.roomId && roomEntry.plants.length > 0);
}

// Adds up plant counts by strain from active room assignment records.
function aggregateAssignmentTotalsMap(assignments) {
  const totals = new Map();

  roomEntriesFromAssignments(assignments).forEach((roomEntry) => {
    roomEntry.plants.forEach((plant) => {
      totals.set(
        plant.strainId,
        (totals.get(plant.strainId) || 0) + plant.count,
      );
    });
  });

  return totals;
}

// Cleans a rooms array so each room only keeps valid plant entries.
function normalizeRoomPlants(roomEntries) {
  return (Array.isArray(roomEntries) ? roomEntries : [])
    .map((roomEntry) => ({
      roomId: roomEntry.roomId,
      plants: (Array.isArray(roomEntry?.plants) ? roomEntry.plants : [])
        .map((plant) => ({
          strainId: getStrainId(plant),
          count: Number(plant?.count) || 0,
        }))
        .filter((plant) => plant.strainId && plant.count > 0),
    }))
    .filter((roomEntry) => roomEntry.roomId && roomEntry.plants.length > 0);
}

// Removes plant counts from rooms when cutting moms from a production batch.
function subtractPlantsFromRooms(roomEntries, requestedCuts) {
  const updatedRooms = normalizeRoomPlants(roomEntries);
  const remainingCuts = new Map(
    Array.from(requestedCuts.entries()).map(([strainId, count]) => [
      strainId,
      count,
    ]),
  );

  updatedRooms.forEach((roomEntry) => {
    roomEntry.plants.forEach((plant) => {
      const remaining = remainingCuts.get(plant.strainId) || 0;
      if (remaining <= 0) return;

      const deduct = Math.min(plant.count, remaining);
      plant.count -= deduct;
      remainingCuts.set(plant.strainId, remaining - deduct);
    });

    roomEntry.plants = roomEntry.plants.filter((plant) => plant.count > 0);
  });

  const hasUnfulfilledCuts = Array.from(remainingCuts.values()).some(
    (count) => count > 0,
  );

  if (hasUnfulfilledCuts) {
    throw new Error("Unable to fulfill mom cut counts from source batch rooms");
  }

  return updatedRooms.filter((roomEntry) => roomEntry.plants.length > 0);
}

// Adds up plant counts by strain from a batch's plants array.
function aggregateBatchPlantsMap(plants) {
  const totals = new Map();

  normalizePlantEntries(plants).forEach((plant) => {
    totals.set(
      plant.strainId,
      (totals.get(plant.strainId) || 0) + plant.count,
    );
  });

  return totals;
}

// Removes plant counts from a batch plants list.
function subtractPlantsFromBatchPlants(plants, requestedCuts) {
  const updatedRooms = subtractPlantsFromRooms(
    [{ roomId: null, plants: normalizePlantEntries(plants) }],
    requestedCuts,
  );

  return updatedRooms[0]?.plants || [];
}

module.exports = {
  aggregatePlantTotalsMap,
  aggregateBatchPlantsMap,
  mapTotalsToPlants,
  normalizePlantEntries,
  normalizeRoomPlants,
  roomEntriesFromAssignments,
  aggregateAssignmentTotalsMap,
  subtractPlantsFromRooms,
  subtractPlantsFromBatchPlants,
};
