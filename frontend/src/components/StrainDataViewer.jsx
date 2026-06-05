import { Fragment, useMemo, useState } from "react";
import { formatDate } from "../utils/formatDate";

// Show strain totals and yield metrics.
function StrainDataViewer({ strains, roomAssignments, harvests }) {
  // Expanded table rows by strain ID.
  const [expandedRows, setExpandedRows] = useState({});

  // Build one summary row per strain.
  const strainRows = useMemo(() => {
    if (!Array.isArray(strains)) return [];

    // Map by strain ID.
    const rowMap = new Map();

    strains.forEach((strain) => {
      rowMap.set(strain._id, {
        strainId: strain._id,
        name: strain.name || "N/A",
        type: strain.type || "N/A",
        status: strain.status || "N/A",
        totalPlants: 0,
        totalWetWeightGrams: 0,
        totalDryWeightGrams: 0,
        totalHarvestPlantCount: 0,
        nextHarvestDate: null,
        plantsByRoom: [],
      });
    });

    if (Array.isArray(roomAssignments)) {
      roomAssignments.forEach((assignment) => {
        const room = assignment?.roomId;
        const batch = assignment?.batchId;
        const roomName = room?.name || "N/A";
        const locationName = room?.locationId?.nickname || "N/A";
        const assignedPlants = Array.isArray(assignment?.assignedPlants)
          ? assignment.assignedPlants
          : [];

        if (!room || !batch || assignedPlants.length === 0) return;

        assignedPlants.forEach((plantEntry) => {
          const strainId = String(
            plantEntry?.strainId?._id || plantEntry?.strainId || "",
          );
          if (!strainId || !rowMap.has(strainId)) return;

          const row = rowMap.get(strainId);
          const plantCount = Number(plantEntry?.count) || 0;

          row.totalPlants += plantCount;
          row.plantsByRoom.push({
            roomName,
            locationName,
            plantCount,
            batchNumber: batch?.batchNumber || "N/A",
            batchType: batch?.batchType || "production",
            batchHarvestDate: batch?.harvestDate || null,
          });

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

    if (Array.isArray(harvests)) {
      harvests.forEach((harvest) => {
        const rooms = Array.isArray(harvest?.rooms) ? harvest.rooms : [];

        rooms.forEach((roomEntry) => {
          const strainsInRoom = Array.isArray(roomEntry?.strains)
            ? roomEntry.strains
            : [];

          strainsInRoom.forEach((strainEntry) => {
            const strainId = String(
              strainEntry?.strainId?._id || strainEntry?.strainId || "",
            );
            if (!strainId || !rowMap.has(strainId)) return;

            const row = rowMap.get(strainId);
            row.totalWetWeightGrams +=
              Number(strainEntry?.totalWetWeightGrams) || 0;
            row.totalDryWeightGrams +=
              Number(strainEntry?.totalDryWeightGrams) || 0;
            row.totalHarvestPlantCount += Number(strainEntry?.plantCount) || 0;
          });
        });
      });
    }

    // Add calculated display fields and sort.
    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        avgDryWeightPerPlant:
          row.totalHarvestPlantCount > 0
            ? (row.totalDryWeightGrams / row.totalHarvestPlantCount).toFixed(2)
            : "N/A",
        wetToDryPercentChange:
          row.totalWetWeightGrams > 0
            ? (
                ((row.totalWetWeightGrams - row.totalDryWeightGrams) /
                  row.totalWetWeightGrams) *
                100
              ).toFixed(2)
            : "N/A",
        nextHarvest: row.nextHarvestDate
          ? formatDate(row.nextHarvestDate)
          : "N/A",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [strains, roomAssignments, harvests]);

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
              <th>Avg Dry (g/plant)</th>
              <th>Wet→Dry Change (%)</th>
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
                  <td>{row.avgDryWeightPerPlant}</td>
                  <td>
                    {row.wetToDryPercentChange === "N/A"
                      ? "N/A"
                      : `${row.wetToDryPercentChange}%`}
                  </td>
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
                          <h4>Yield Metrics</h4>
                          <p>
                            Historical average dry weight per plant:{" "}
                            <strong>{row.avgDryWeightPerPlant}</strong>
                            {row.avgDryWeightPerPlant !== "N/A" ? " g" : ""}
                          </p>
                          <p>
                            Historical wet-to-dry change:{" "}
                            <strong>
                              {row.wetToDryPercentChange === "N/A"
                                ? "N/A"
                                : `${row.wetToDryPercentChange}%`}
                            </strong>
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
