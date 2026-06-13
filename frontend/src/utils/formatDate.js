// Normalize mixed date inputs into a safe short display string.
export function formatDate(value) {
  // Accepts ISO strings, Date-compatible values, or null/undefined.
  // Return a consistent fallback whenever value is empty/null.
  if (!value) return "N/A";
  const date = new Date(value);
  // Guard against invalid date parsing so UI never shows "Invalid Date".
  if (Number.isNaN(date.getTime())) return "N/A";
  // Use locale formatting so users see familiar regional date output.
  return date.toLocaleDateString();
}
