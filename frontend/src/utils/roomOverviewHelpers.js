/**
 * Shapes room + assignment data for the Room Overview grid in RoomViewerPanel.jsx.
 */

// Returns a MUI chip color name based on batch lifecycle stage.
export function stageColor(stage) {
  const stageName = String(stage || "").toLowerCase();

  if (stageName === "flower" || stageName === "harvestready") return "warning";
  if (stageName === "drying") return "info";
  if (stageName === "completed") return "default";
  return "success";
}

// Chip color hint for room type labels on overview cards.
export function roomTypeColor(roomType) {
  const type = String(roomType || "").toLowerCase();

  if (type === "flower") return "warning";
  if (type === "drying") return "info";
  if (type === "mom") return "secondary";
  if (type === "veg") return "success";
  if (type === "clone") return "primary";
  return "default";
}

// Totals plant counts by strain name for one room's assignments.
function countPlantsByStrain(assignments) {
  const countByStrainName = {};

  for (const assignment of assignments) {
    const plants = assignment?.assignedPlants || [];

    for (const plant of plants) {
      const strainName = plant?.strainId?.name || "Unknown Strain";
      const plantCount = Number(plant?.count) || 0;

      if (plantCount <= 0) continue;

      const previousCount = countByStrainName[strainName] || 0;
      countByStrainName[strainName] = previousCount + plantCount;
    }
  }

  const lines = Object.entries(countByStrainName).map(([name, count]) => ({
    name,
    count,
  }));

  lines.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return lines;
}

// Pulls the room id off an assignment whether roomId is an object or a string.
function getRoomIdFromAssignment(assignment) {
  return String(assignment?.roomId?._id || assignment?.roomId || "");
}

// Builds the summary object shown on one room card in the overview.
function buildRoomCard(room, assignmentsForThisRoom) {
  const strainLines = countPlantsByStrain(assignmentsForThisRoom);
  const totalPlants = strainLines.reduce((sum, line) => sum + line.count, 0);

  const batches = [];
  const seenBatchIds = new Set();

  for (const assignment of assignmentsForThisRoom) {
    const batch = assignment?.batchId;
    const batchId = String(batch?._id || batch || "");
    if (!batchId || seenBatchIds.has(batchId)) continue;
    seenBatchIds.add(batchId);
    batches.push(batch);
  }

  const batchCount = batches.length;
  const firstBatch = batches[0] || null;
  let batchChipLabel = null;

  if (batchCount === 1) {
    batchChipLabel = firstBatch?.batchNumber || null;
  } else if (batchCount > 1) {
    batchChipLabel = `${batchCount} batches`;
  }

  let harvestDate = null;
  for (const batch of batches) {
    if (!batch?.harvestDate) continue;
    const candidate = new Date(batch.harvestDate);
    if (Number.isNaN(candidate.getTime())) continue;
    if (!harvestDate || candidate < new Date(harvestDate)) {
      harvestDate = batch.harvestDate;
    }
  }

  const assignmentStartedAt =
    assignmentsForThisRoom
      .map((assignment) => assignment?.startedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a) - new Date(b))[0] || null;

  return {
    room,
    strainLines,
    totalPlants,
    batchChipLabel,
    batchCount,
    lifecycleStage: firstBatch?.lifecycleStage || null,
    harvestDate,
    assignmentStartedAt,
    headerDate: harvestDate || assignmentStartedAt || null,
  };
}

// Groups all rooms by location with strain, batch, and plant totals for the overview.
export function buildRoomOverview(rooms, roomAssignments) {
  const allRooms = Array.isArray(rooms) ? rooms : [];
  const allAssignments = Array.isArray(roomAssignments) ? roomAssignments : [];

  const activeAssignments = allAssignments.filter(
    (assignment) => assignment?.active !== false,
  );

  const assignmentsByRoomId = {};

  for (const assignment of activeAssignments) {
    const roomId = getRoomIdFromAssignment(assignment);
    if (!roomId) continue;

    if (!assignmentsByRoomId[roomId]) {
      assignmentsByRoomId[roomId] = [];
    }
    assignmentsByRoomId[roomId].push(assignment);
  }

  const locationsById = {};

  for (const room of allRooms) {
    const location = room?.locationId;
    const locationId = String(location?._id || "unknown");
    const locationName = location?.nickname || "Unknown Location";

    if (!locationsById[locationId]) {
      locationsById[locationId] = {
        locationId,
        locationName,
        rooms: [],
      };
    }

    const roomId = String(room._id);
    const assignmentsForRoom = assignmentsByRoomId[roomId] || [];
    const card = buildRoomCard(room, assignmentsForRoom);

    locationsById[locationId].rooms.push(card);
  }

  const locations = Object.values(locationsById);

  for (const location of locations) {
    location.rooms.sort(
      (a, b) =>
        (a.room?.type || "").localeCompare(b.room?.type || "") ||
        (a.room?.name || "").localeCompare(b.room?.name || ""),
    );
  }

  locations.sort((a, b) => a.locationName.localeCompare(b.locationName));
  return locations;
}
