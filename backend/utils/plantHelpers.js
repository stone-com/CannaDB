// Return a plain string strain ID from either a populated doc or raw ObjectId.
function getStrainId(plantEntry) {
  if (!plantEntry?.strainId) return null;
  if (typeof plantEntry.strainId === "string") return plantEntry.strainId;
  if (plantEntry.strainId?._id) return String(plantEntry.strainId._id);
  return String(plantEntry.strainId);
}

// Sum plant counts by strain across a batch-style rooms array.
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

// Convert a totals Map back into the { strainId, count } shape used by schemas.
function mapTotalsToPlants(totalsMap) {
  return Array.from(totalsMap.entries()).map(([strainId, count]) => ({
    strainId,
    count,
  }));
}

// Clean a flat plants array so every entry has a string strainId and valid count.
function normalizePlantEntries(plantEntries) {
  return (Array.isArray(plantEntries) ? plantEntries : [])
    .map((plant) => ({
      strainId: getStrainId(plant),
      count: Number(plant?.count) || 0,
    }))
    .filter((plant) => plant.strainId && plant.count > 0);
}

// Turn active room assignments into the same room/plant shape used elsewhere.
function roomEntriesFromAssignments(assignments) {
  return (Array.isArray(assignments) ? assignments : [])
    .filter((assignment) => assignment?.active !== false)
    .map((assignment) => ({
      roomId: assignment?.roomId?._id || assignment?.roomId,
      plants: normalizePlantEntries(assignment?.assignedPlants),
    }))
    .filter((roomEntry) => roomEntry.roomId && roomEntry.plants.length > 0);
}

// Sum plant counts by strain using active room assignment records.
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

// Clean a rooms array so each room only keeps valid plant entries.
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

// Remove requested plant counts from room data, used when cutting moms from a batch.
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

module.exports = {
  aggregatePlantTotalsMap,
  mapTotalsToPlants,
  normalizeRoomPlants,
  roomEntriesFromAssignments,
  aggregateAssignmentTotalsMap,
  subtractPlantsFromRooms,
};
