import { Fragment, useMemo, useState } from "react";

// Small helper to keep date display consistent in one place.
// We keep it simple for beginners: convert to Date, then toLocaleDateString.
const formatDate = (value) => {
  // Guard clause: if the input is empty/null/undefined, show a fallback.
  // Guard clauses are early returns that keep functions easier to read.
  if (!value) {
    return "N/A";
  }

  // new Date(...) converts strings like ISO timestamps into Date objects.
  const date = new Date(value);
  // Number.isNaN(...) checks whether date parsing failed.
  // getTime() returns a number timestamp, or NaN for invalid dates.
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  // toLocaleDateString() gives a human-friendly date in the user's locale.
  return date.toLocaleDateString();
};

// Builds a dropdown label so users can identify harvests quickly.
// Format: date — harvest number — location — room list
const buildHarvestOptionLabel = (harvest) => {
  if (!harvest) {
    return "N/A";
  }

  const dateText = formatDate(harvest.harvestDate);
  const harvestNumberText = harvest.harvestNumber || "No Number";
  const locationText =
    harvest.locationId?.nickname || harvest.locationId || "No Location";

  const rooms = Array.isArray(harvest.rooms) ? harvest.rooms : [];
  const roomNames = rooms
    .map((roomEntry) => roomEntry?.roomId?.name || roomEntry?.roomId)
    .filter(Boolean)
    .join(", ");

  const roomText = roomNames || "No Rooms";

  return `${dateText} — ${harvestNumberText} — ${locationText} — ${roomText}`;
};

function HarvestReportPage({ harvests }) {
  // props are received as a single object.
  // Here we destructure `harvests` directly in the parameter list.

  // Track which harvest is currently selected in the dropdown.
  // useState("") sets initial value to an empty string.
  // setSelectedHarvestId(...) updates the state and triggers re-render.
  const [selectedHarvestId, setSelectedHarvestId] = useState("");

  // We store expanded rows in an object map for binary lookups.
  // Example: { "roomId-strainId-0": true, "roomId-strainId-1": false }
  // Object maps are convenient for "toggle by key".
  const [expandedRows, setExpandedRows] = useState({});

  // Sort harvest options by date (newest first) so users pick recent data quickly.
  // useMemo memoizes derived data so we only recompute when dependencies change.
  // Dependency array: [harvests] means this block reruns only when `harvests` changes.
  const sortedHarvests = useMemo(() => {
    // Defensive check: the API should return an array, but we still protect against bad data.
    if (!Array.isArray(harvests)) {
      return [];
    }

    // [...harvests] makes a shallow copy so we don't mutate original state.
    // sort(...) mutates arrays in place, so copying first is important.
    return [...harvests].sort(
      // Newest first: larger timestamp comes before smaller timestamp.
      (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
    );
  }, [harvests]);

  // Derive a safe selected ID without needing an effect.
  // Priority: user-selected ID (if still valid) -> first available harvest -> empty string.
  const effectiveSelectedHarvestId = useMemo(() => {
    // No options available, so selection must be empty.
    if (sortedHarvests.length === 0) {
      return "";
    }

    // some(...) returns true if at least one item passes the condition.
    // We use this to verify the currently selected ID still exists after refreshes.
    const stillExists = sortedHarvests.some(
      (harvest) => harvest._id === selectedHarvestId,
    );

    // Keep user selection if still valid.
    if (selectedHarvestId && stillExists) {
      return selectedHarvestId;
    }

    // Default selection: first item in newest-first list.
    return sortedHarvests[0]._id;
  }, [selectedHarvestId, sortedHarvests]);

  // Find the full selected harvest object so we can render details.
  // find(...) returns first matching object, or undefined if none.
  const selectedHarvest = useMemo(
    () =>
      sortedHarvests.find(
        (harvest) => harvest._id === effectiveSelectedHarvestId,
      ),
    [effectiveSelectedHarvestId, sortedHarvests],
  );

  // Convert harvest data into room sections.
  // Each section contains one room + a table-ready list of strain rows.
  const roomSections = useMemo(() => {
    // If selected harvest doesn't exist yet, render no room sections.
    if (!selectedHarvest || !Array.isArray(selectedHarvest.rooms)) {
      return [];
    }

    // We'll push each room section object into this array.
    const sections = [];

    // forEach(...) loops through each room entry.
    // roomIndex is used to help generate unique keys.
    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      // Optional chaining (?.) avoids crashes if roomEntry is null/undefined.
      const roomId = roomEntry?.roomId;

      // roomId can be either populated object or raw string ID.
      // `||` fallback chain: use first truthy value.
      const roomName = roomId?.name || roomId || "N/A";
      const roomType = roomId?.type || "N/A";
      // `??` nullish coalescing only falls back on null/undefined (not 0).
      const roomSqFoot = roomId?.sqFoot ?? "N/A";
      const roomSectionKey = `${selectedHarvest._id}-room-${roomIndex}`;

      // Keep strains safe as array before looping.
      const strains = Array.isArray(roomEntry?.strains)
        ? roomEntry.strains
        : [];

      // Loop each strain inside the current room.
      const strainRows = strains.map((strainEntry, strainIndex) => {
        const strainId = strainEntry?.strainId;

        // strainId can also be populated object or raw string ID.
        const strainName = strainId?.name || strainId || "N/A";

        return {
          // React list keys must be unique + stable within the list.
          // Combining harvest id + room index + strain index gives a practical unique key.
          key: `${selectedHarvest._id}-${roomIndex}-${strainIndex}`,
          strainName,
          plantCount: strainEntry?.plantCount ?? 0,
          totalWetWeightGrams: strainEntry?.totalWetWeightGrams ?? 0,
          totalDryWeightGrams: strainEntry?.totalDryWeightGrams ?? 0,
          wetPlantAvgWeightGrams: strainEntry?.wetPlantAvgWeightGrams ?? "N/A",
          dryPlantAvgWeightGrams: strainEntry?.dryPlantAvgWeightGrams ?? "N/A",
          percentChangeWetToDry: strainEntry?.percentChangeWetToDry ?? "N/A",
          yieldGramsPerSquareFoot:
            strainEntry?.yieldGramsPerSquareFoot ?? "N/A",
          totes: Array.isArray(strainEntry?.totes) ? strainEntry.totes : [],
        };
      });

      sections.push({
        roomSectionKey,
        roomName,
        roomType,
        roomSqFoot,
        strainRows,
      });
    });

    return sections;
  }, [selectedHarvest]);

  // Build a display string of room names for the summary card.
  const roomNamesSummary = useMemo(() => {
    if (roomSections.length === 0) {
      return "N/A";
    }

    return roomSections.map((section) => section.roomName).join(", ");
  }, [roomSections]);

  // locationId can be populated object or raw string ID, same pattern as room/strain refs.
  const locationName =
    selectedHarvest?.locationId?.nickname ||
    selectedHarvest?.locationId ||
    "N/A";

  // Toggle function for expandable detail rows.
  // Functional update receives latest previous state (`prev`) safely.
  const toggleExpandedRow = (rowKey) => {
    setExpandedRows((prev) => ({
      // Spread syntax copies all old keys into a new object.
      ...prev,
      // [rowKey] is a computed property name in an object literal.
      // This flips true <-> false for the clicked row.
      [rowKey]: !prev[rowKey],
    }));
  };

  return (
    // JSX must return one top-level element.
    <div className="form-container">
      <h2>Harvest Report</h2>
      <p>Select a harvest date to view full room + strain details.</p>

      <div className="form-field">
        {/* htmlFor links this label to the select element by id. */}
        <label className="form-label" htmlFor="harvest-report-select">
          Harvest Date:
        </label>
        <select
          id="harvest-report-select"
          className="form-select"
          value={effectiveSelectedHarvestId}
          onChange={(e) => {
            // e is the browser event object.
            // e.target.value is the selected <option>'s value.
            setSelectedHarvestId(e.target.value);
            // Reset expanded rows when changing harvest for a clean view.
            setExpandedRows({});
          }}
        >
          {/* Conditional rendering with && means: render right side only if condition is true. */}
          {sortedHarvests.length === 0 && <option value="">No harvests</option>}
          {/* map(...) converts array data into JSX elements. */}
          {sortedHarvests.map((harvest) => (
            // key helps React track each option efficiently during re-renders.
            <option key={harvest._id} value={harvest._id}>
              {buildHarvestOptionLabel(harvest)}
            </option>
          ))}
        </select>
      </div>

      {/* Ternary rendering: condition ? showWhenTrue : showWhenFalse */}
      {!selectedHarvest ? (
        <p>No harvest selected.</p>
      ) : (
        <>
          {/* Fragment shorthand (<></>) avoids adding an extra DOM wrapper element. */}
          <div className="harvest-summary-grid">
            <div className="strain-card">
              <h3>Harvest Number</h3>
              <p>{selectedHarvest.harvestNumber || "N/A"}</p>
            </div>
            <div className="strain-card">
              <h3>Location</h3>
              <p>{locationName}</p>
            </div>
            <div className="strain-card">
              <h3>Rooms</h3>
              <p>{roomNamesSummary}</p>
            </div>
            <div className="strain-card">
              <h3>Total Plants</h3>
              {/* Nullish coalescing keeps 0 as valid value, only falls back on null/undefined. */}
              <p>{selectedHarvest.totalPlantCount ?? 0}</p>
            </div>
            <div className="strain-card">
              <h3>Total Wet (g)</h3>
              <p>{selectedHarvest.totalWetWeightGrams ?? 0}</p>
            </div>
            <div className="strain-card">
              <h3>Total Dry (g)</h3>
              <p>{selectedHarvest.totalDryWeightGrams ?? 0}</p>
            </div>
            <div className="strain-card">
              <h3>Yield (g / sq ft)</h3>
              <p>{selectedHarvest.totalYieldGramsPerSquareFoot ?? "N/A"}</p>
            </div>
          </div>

          {/* If no room sections exist, show an empty-state message. */}
          {roomSections.length === 0 ? (
            <p>No room/strain rows found for this harvest.</p>
          ) : (
            roomSections.map((section) => (
              <div
                className="harvest-room-section"
                key={section.roomSectionKey}
              >
                <h3>
                  Room: {section.roomName} ({section.roomType})
                </h3>
                <p>Sq Ft: {section.roomSqFoot}</p>

                {section.strainRows.length === 0 ? (
                  <p>No strains found for this room.</p>
                ) : (
                  <div className="harvest-table-wrap">
                    {/* Semantic table structure: thead for headers, tbody for data rows. */}
                    <table className="harvest-table">
                      <thead>
                        <tr>
                          <th>Expand</th>
                          <th>Strain</th>
                          <th>Plant Count</th>
                          <th>Wet Weight (g)</th>
                          <th>Dry Weight (g)</th>
                          <th>Yield (g/sq ft)</th>
                          <th>Dry Avg (g/plant)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.strainRows.map((row) => (
                          // Fragment with key lets us return multiple <tr> per mapped item.
                          <Fragment key={row.key}>
                            <tr>
                              <td>
                                <button
                                  type="button"
                                  className="table-toggle-button"
                                  // Arrow function defers execution until click happens.
                                  onClick={() => toggleExpandedRow(row.key)}
                                >
                                  {/* Show minus when expanded, plus when collapsed. */}
                                  {expandedRows[row.key] ? "−" : "+"}
                                </button>
                              </td>
                              <td>{row.strainName}</td>
                              <td>{row.plantCount}</td>
                              <td>{row.totalWetWeightGrams}</td>
                              <td>{row.totalDryWeightGrams}</td>
                              <td>{row.yieldGramsPerSquareFoot}</td>
                              <td>{row.dryPlantAvgWeightGrams}</td>
                            </tr>

                            {/* Conditional detail row, only rendered when this row is expanded. */}
                            {expandedRows[row.key] && (
                              <tr className="harvest-detail-row">
                                {/* colSpan merges cells so details can span full table width. */}
                                <td colSpan={7}>
                                  <div className="harvest-detail-grid">
                                    <p>
                                      <strong>Wet Avg / Plant (g):</strong>{" "}
                                      {row.wetPlantAvgWeightGrams}
                                    </p>
                                    <p>
                                      <strong>% Change Wet→Dry:</strong>{" "}
                                      {row.percentChangeWetToDry}
                                    </p>
                                    <p>
                                      <strong>Tote Wet Weights:</strong>{" "}
                                      {row.totes.length === 0
                                        ? "None"
                                        : // map(...).join(", ") turns tote values into readable comma-separated text.
                                          row.totes
                                            .map((tote) => tote?.wetWeight ?? 0)
                                            .join(", ")}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

export default HarvestReportPage;
