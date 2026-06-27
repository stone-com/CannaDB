/**
 * Session draft for the dry weight form — survives minimize, close, and refresh.
 */

const STORAGE_KEY = "cannadb_dry_weight_form_draft";

export function readDryWeightFormDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      searchQuery: String(parsed.searchQuery || ""),
      batchPickerExpanded: Boolean(parsed.batchPickerExpanded),
      selectedBatchId: String(parsed.selectedBatchId || ""),
      selectedDryRoomId: String(parsed.selectedDryRoomId || ""),
      selectedStrainKey: parsed.selectedStrainKey ? String(parsed.selectedStrainKey) : null,
      dryWeightInput: String(parsed.dryWeightInput || ""),
      dryWeightsByKey:
        parsed.dryWeightsByKey && typeof parsed.dryWeightsByKey === "object"
          ? parsed.dryWeightsByKey
          : {},
    };
  } catch {
    return null;
  }
}

export function persistDryWeightFormDraft(draft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures in private browsing, etc.
  }
}

export function clearDryWeightFormDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
