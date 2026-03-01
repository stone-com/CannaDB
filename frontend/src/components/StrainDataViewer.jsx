import { Fragment, useMemo, useState } from "react";

// Date helper used in the expandable Plants section.
// We keep one formatter function so date output is consistent everywhere.
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

function StrainDataViewer({ strains, rooms }) {
  // Tracks which strain rows are expanded in the table.
  // Example: { "strainId1": true, "strainId2": false }
  const [expandedRows, setExpandedRows] = useState({});

  // Build derived table data from raw `strains` + room batch assignments.
  // useMemo avoids recomputing this on every render unless inputs change.
  const strainRows = useMemo(() => {
    if (!Array.isArray(strains)) {
      return [];
    }

    // Initialize one row entry per strain, then fill metrics from room.batchId.
    const rowMap = new Map();

    strains.forEach((strain) => {
      rowMap.set(strain._id, {
        strainId: strain._id,
        name: strain.name || "N/A",
        type: strain.type || "N/A",
        status: strain.status || "N/A",
        totalPlants: 0,
        // Not implemented yet in backend inventory system.
        totalDrying: "Coming Soon",
        totalInventory: "Coming Soon",
        nextHarvestDate: null,
        plantsByRoom: [],
      });
    });

    // Read room assignments and attach strain plant counts from each room's batch.
    if (Array.isArray(rooms)) {
      rooms.forEach((room) => {
        const roomName = room?.name || "N/A";
        const locationName = room?.locationId?.nickname || "N/A";
        const batch = room?.batchId;

        if (!batch || !Array.isArray(batch?.plants)) {
          return;
        }

        batch.plants.forEach((plantEntry) => {
          const strainRef = plantEntry?.strainId;
          const strainId = strainRef?._id || strainRef;

          // Skip unknown strains that are not in `/api/strains` list.
          if (!strainId || !rowMap.has(strainId)) {
            return;
          }

          const row = rowMap.get(strainId);
          const plantCount = Number(plantEntry?.count) || 0;

          row.totalPlants += plantCount;
          row.plantsByRoom.push({
            roomName,
            locationName,
            plantCount,
            batchNumber: batch?.batchNumber || "N/A",
            batchHarvestDate: batch?.harvestDate || null,
          });

          // Track nearest upcoming batch harvest date for this strain.
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

    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        // Keep placeholder text if no upcoming batch harvest date found yet.
        nextHarvest: row.nextHarvestDate
          ? formatDate(row.nextHarvestDate)
          : "N/A",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [strains, rooms]);

  // Expand/collapse handler for each strain row.
  const toggleExpandedRow = (strainId) => {
    setExpandedRows((prev) => ({
      ...prev,
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
            {strainRows.map((row) => (
              <Fragment key={row.strainId}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className="table-toggle-button"
                      onClick={() => toggleExpandedRow(row.strainId)}
                    >
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
