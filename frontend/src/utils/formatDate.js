// Turns a date value into a short readable string for the UI, or "N/A" if missing/invalid.
export function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}
