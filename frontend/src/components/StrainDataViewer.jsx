import { Fragment, useMemo, useState } from "react";

// Fragment is a React wrapper that lets you return multiple elements without
// adding an extra DOM node like <div>. We import it here so we can use it with
// a `key` prop in the table (the shorthand <></> doesn't support key).

// formatDate is a helper function defined outside the component so it can be
// reused anywhere in this file. It lives at the top so it's easy to find.
const formatDate = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString();
};

// StrainDataViewer shows a table of all strains with aggregated plant counts
// pulled from the rooms that have active batches assigned to them.
// It receives `strains` and `rooms` as props from App.jsx.
function StrainDataViewer({ strains, rooms }) {
  // expandedRows tracks which table rows are currently showing their detail section.
  // It's an object used as a key-value store (a "lookup map"):
  //   { "abc123": true }  → that strain's row is expanded
  //   { "abc123": false } → collapsed (or not in the object yet → also collapsed)
  // Using an object lets us look up any strain's expansion state by ID in O(1) time.
  const [expandedRows, setExpandedRows] = useState({});

  // useMemo caches the result of this computation.
  // It only re-runs when `strains` or `rooms` changes — not on every render.
  // This matters because this is a fairly heavy operation (looping through rooms
  // and plants to aggregate counts). We don't want to redo it unnecessarily.
  const strainRows = useMemo(() => {
    if (!Array.isArray(strains)) {
      return [];
    }

    // Map is a built-in JS data structure similar to an object, but designed
    // for storing key-value pairs where both keys and values can be anything.
    // We use it here as a lookup table: strainId → row data.
    // It's faster than an array for "find by ID" operations.
    const rowMap = new Map();

    // Build one row entry per strain with default/empty metrics.
    // forEach loops through every strain and calls the function once per item.
    strains.forEach((strain) => {
      // rowMap.set(key, value) stores the value under that key.
      rowMap.set(strain._id, {
        strainId: strain._id,
        name: strain.name || "N/A",
        type: strain.type || "N/A",
        status: strain.status || "N/A",
        totalPlants: 0,
        totalDrying: "Coming Soon",
        totalInventory: "Coming Soon",
        nextHarvestDate: null,
        plantsByRoom: [],
      });
    });

    // Now loop through rooms and fill in the plant data from each room's batch.
    if (Array.isArray(rooms)) {
      rooms.forEach((room) => {
        // Optional chaining (?.) — safely access a property that might not exist.
        // room?.name means: "if room exists, get room.name; if room is null/undefined,
        // don't crash, just return undefined". The || "N/A" fallback handles that.
        const roomName = room?.name || "N/A";
        // room?.locationId?.nickname chains two optional accesses:
        // first safely access locationId, then safely access its nickname.
        const locationName = room?.locationId?.nickname || "N/A";
        const batch = room?.batchId;

        // If this room has no batch (or the batch has no plants), skip it.
        if (!batch || !Array.isArray(batch?.plants)) {
          return; // `return` inside forEach acts like `continue` in a regular loop
        }

        batch.plants.forEach((plantEntry) => {
          const strainId = plantEntry?.strainId?._id;

          // Skip if the strain isn't in our strains list.
          if (!strainId || !rowMap.has(strainId)) {
            return;
          }

          // rowMap.get(key) retrieves the row data we created above.
          const row = rowMap.get(strainId);
          const plantCount = Number(plantEntry?.count) || 0;

          // Add to the running total and push this room's data into the detail list.
          row.totalPlants += plantCount;
          row.plantsByRoom.push({
            roomName,
            locationName,
            plantCount,
            batchNumber: batch?.batchNumber || "N/A",
            batchHarvestDate: batch?.harvestDate || null,
          });

          // Track the nearest upcoming harvest date for this strain.
          const harvestDateValue = batch?.harvestDate
            ? new Date(batch.harvestDate)
            : null;
          if (harvestDateValue && !Number.isNaN(harvestDateValue.getTime())) {
            const now = new Date();
            if (harvestDateValue >= now) {
              const currentNext = row.nextHarvestDate
                ? new Date(row.nextHarvestDate)
                : null;

              if (!currentNext || harvestDateValue < currentNext) {
                row.nextHarvestDate = harvestDateValue.toISOString();
              }
            }
          }
        });
      });
    }

    // Array.from(rowMap.values()) converts the Map's values into a regular array.
    // Then we chain .map() and .sort() on it:
    //   .map() transforms each row object by adding the formatted nextHarvest string
    //   .sort() alphabetizes by strain name using localeCompare (handles accents, etc.)
    return Array.from(rowMap.values())
      .map((row) => ({
        // ...row copies all existing properties into the new object
        ...row,
        nextHarvest: row.nextHarvestDate
          ? formatDate(row.nextHarvestDate)
          : "N/A",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [strains, rooms]);

  // toggleExpandedRow flips the expansion state for one row.
  // It uses a functional state update so it always works with the latest state.
  const toggleExpandedRow = (strainId) => {
    setExpandedRows((prev) => ({
      // ...prev copies all existing entries so we don't lose other expanded rows
      ...prev,
      // [strainId] is a computed property name — the variable's value becomes the key.
      // !prev[strainId] flips true → false and false → true (undefined is also falsy).
      [strainId]: !prev[strainId],
    }));
  };

  if (strainRows.length === 0) {
    return <p>No strains yet.</p>;
  }

  return (
    <div className="strain-viewer-wrap">
      <div className="harvest-table-wrap">
        <table className="harvest-table strain-viewer-table">
          <thead>
            <tr>
              <th>Expand</th>
              <th>Strain</th>
              <th>Type</th>
              <th>Status</th>
              <th>Total Plants</th>
              <th>Total Drying</th>
              <th>Total Inventory</th>
              <th>Next Harvest</th>
            </tr>
          </thead>
          <tbody>
            {/* strainRows.map() converts each row object into a pair of <tr> elements.
               Fragment with a `key` prop lets React track the pair without adding a DOM node.
               We can't use <></> shorthand here because it doesn't support the key prop. */}
            {strainRows.map((row) => (
              <Fragment key={row.strainId}>
                <tr>
                  <td>
                    {/* The expand/collapse button just flips a boolean in state */}
                    <button
                      type="button"
                      className="table-toggle-button"
                      onClick={() => toggleExpandedRow(row.strainId)}
                    >
                      {/* Ternary: show minus when expanded, plus when collapsed */}
                      {expandedRows[row.strainId] ? "−" : "+"}
                    </button>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.type}</td>
                  <td>{row.status}</td>
                  <td>{row.totalPlants}</td>
                  <td>{row.totalDrying}</td>
                  <td>{row.totalInventory}</td>
                  <td>{row.nextHarvest}</td>
                </tr>

                {expandedRows[row.strainId] && (
                  <tr className="harvest-detail-row">
                    <td colSpan={8}>
                      <div className="strain-expand-grid">
                        <div className="strain-expand-section">
                          <h4>Plants</h4>
                          {row.plantsByRoom.length === 0 ? (
                            <p>No plant/room data available yet.</p>
                          ) : (
                            <div className="harvest-table-wrap">
                              <table className="harvest-table">
                                <thead>
                                  <tr>
                                    <th>Room</th>
                                    <th>Location</th>
                                    <th>Batch</th>
                                    <th>Plant Count</th>
                                    <th>Batch Harvest Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.plantsByRoom.map((item, index) => (
                                    <tr
                                      key={`${row.strainId}-plant-row-${index}`}
                                    >
                                      <td>{item.roomName}</td>
                                      <td>{item.locationName}</td>
                                      <td>{item.batchNumber}</td>
                                      <td>{item.plantCount}</td>
                                      <td>
                                        {formatDate(item.batchHarvestDate)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="strain-expand-section">
                          <h4>Inventory</h4>
                          <p>
                            Inventory tracking columns are placeholders for now.
                            This section will be connected once inventory
                            endpoints are implemented.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StrainDataViewer;
