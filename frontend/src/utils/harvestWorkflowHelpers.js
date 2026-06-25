/** Shared helpers for harvest intake and dry weight workflow forms. */

export function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDefaultByClosestDate(items, getDateValue) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const today = startOfDay(new Date());
  const entries = items.map((item) => {
    const rawDate = getDateValue(item);
    const dateValue = rawDate ? startOfDay(rawDate) : null;
    const valid =
      dateValue instanceof Date && !Number.isNaN(dateValue.getTime());

    return {
      item,
      valid,
      distance: valid ? Math.abs(dateValue - today) : Number.POSITIVE_INFINITY,
      isToday: valid && dateValue.getTime() === today.getTime(),
    };
  });

  const todayMatch = entries.find((entry) => entry.isToday);
  if (todayMatch) return todayMatch.item;

  const dated = entries.filter((entry) => entry.valid);
  if (dated.length === 0) return items[0];

  dated.sort((a, b) => a.distance - b.distance);
  return dated[0].item;
}

export function isDateToday(value) {
  if (!value) return false;
  return startOfDay(value).getTime() === startOfDay(new Date()).getTime();
}

export function groupHarvestRoomsByDryRoom(activePlants, totes, dryRoomByStrainId) {
  const byRoom = new Map();

  activePlants.forEach((plant) => {
    const strainId = plant?.strainId?._id;
    const dryRoomId = dryRoomByStrainId[strainId];
    if (!strainId || !dryRoomId) return;

    if (!byRoom.has(String(dryRoomId))) {
      byRoom.set(String(dryRoomId), []);
    }

    byRoom.get(String(dryRoomId)).push({
      strainId,
      plantCount: plant.count || 0,
      totes: (totes[strainId] || []).map((weight) => ({ wetWeight: weight })),
    });
  });

  return Array.from(byRoom.entries()).map(([roomId, strains]) => ({
    roomId,
    strains,
  }));
}

export function buildDefaultDryRoomMap(activePlants, defaultDryRoomId) {
  if (!defaultDryRoomId) return {};

  return activePlants.reduce((map, plant) => {
    const strainId = plant?.strainId?._id;
    if (strainId) {
      map[strainId] = defaultDryRoomId;
    }
    return map;
  }, {});
}
