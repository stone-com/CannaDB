/**
 * Shared config for dashboard workspace panels (floating windows).
 */

export const PANEL_KEYS = [
  "strains",
  "harvestReport",
  "roomViewer",
  "harvestForm",
  "dryWeightForm",
];

const PANEL_DEFAULT_LAYOUTS = {
  strains: { x: 480, y: 88, w: 1120, h: 660 },
  harvestReport: { x: 620, y: 220, w: 860, h: 540 },
  roomViewer: { x: 460, y: 180, w: 1000, h: 640 },
  harvestForm: { x: 260, y: 96, w: 780, h: 520 },
  dryWeightForm: { x: 260, y: 140, w: 880, h: 540 },
};

const STORAGE_KEY = "cannadb_window_layouts";

export function createInitialWindowLayouts() {
  const saved = readSavedLayouts();
  const layouts = {};

  PANEL_KEYS.forEach((key) => {
    layouts[key] = {
      ...PANEL_DEFAULT_LAYOUTS[key],
      ...(saved[key] || {}),
    };
  });

  return layouts;
}

function readSavedLayouts() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function persistWindowLayouts(layouts) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // Ignore storage failures in private browsing, etc.
  }
}

export function getPanelTitle(key, counts = {}) {
  if (key === "strains") return `Strains (${counts.strains ?? 0})`;
  if (key === "harvestReport") return "Harvest Report";
  if (key === "roomViewer") return "Room Viewer";
  if (key === "harvestForm") return "Add Harvest";
  if (key === "dryWeightForm") return "Add Dry Weights";
  return "Panel";
}
