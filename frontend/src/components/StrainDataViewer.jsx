import { Fragment, useMemo, useState } from "react";

// Formats a date value, returning "N/A" for nulls or invalid dates.
const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
};

// Aggregates plant counts from active room batches, grouped by strain.
function StrainDataViewer({ strains, rooms }) {
  // Tracks which rows are expanded. { strainId: true } = expanded.
  const [expandedRows, setExpandedRows] = useState({});

  // Builds one row per strain with total plant counts aggregated across all rooms.
  const strainRows = useMemo(() => {
    if (!Array.isArray(strains)) return [];

    // strainId → row data lookup map.
    const rowMap = new Map();

    strains.forEach((strain) => {
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

    // Fill in plant data from each room's active batch.
    if (Array.isArray(rooms)) {
      rooms.forEach((room) => {
        const roomName = room?.name || "N/A";
        const locationName = room?.locationId?.nickname || "N/A";
        const batch = room?.batchId;

        if (!batch || !Array.isArray(batch?.rooms)) return;

        // Find the entry in this batch's rooms that corresponds to the current room.
        const roomEntry = batch.rooms.find(
          (r) => String(r.roomId) === String(room._id),
        );
        if (!roomEntry || !Array.isArray(roomEntry.plants)) return;

        roomEntry.plants.forEach((plantEntry) => {
          const strainId = plantEntry?.strainId?._id;
          if (!strainId || !rowMap.has(strainId)) return;

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

    // Sort alphabetically and attach the formatted nextHarvest string.
    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        nextHarvest: row.nextHarvestDate
          ? formatDate(row.nextHarvestDate)
          : "N/A",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [strains, rooms]);

  const toggleExpandedRow = (strainId) => {
    setExpandedRows((prev) => ({ ...prev, [strainId]: !prev[strainId] }));
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
