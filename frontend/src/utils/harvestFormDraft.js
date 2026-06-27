/**
 * Session draft for the harvest intake form — survives minimize, close, and refresh.
 */

const STORAGE_KEY = "cannadb_harvest_form_draft";

export function readHarvestFormDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      searchQuery: String(parsed.searchQuery || ""),
      batchPickerExpanded: Boolean(parsed.batchPickerExpanded),
      selectedBatchId: String(parsed.selectedBatchId || ""),
      selectedRoomId: String(parsed.selectedRoomId || ""),
      selectedStrainId: parsed.selectedStrainId ? String(parsed.selectedStrainId) : null,
      dryRoomByStrainId:
        parsed.dryRoomByStrainId && typeof parsed.dryRoomByStrainId === "object"
          ? parsed.dryRoomByStrainId
          : {},
      totes: parsed.totes && typeof parsed.totes === "object" ? parsed.totes : {},
      weightInput: String(parsed.weightInput || ""),
    };
  } catch {
    return null;
  }
}

export function persistHarvestFormDraft(draft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures in private browsing, etc.
  }
}

export function clearHarvestFormDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
