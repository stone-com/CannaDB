import { Fragment, useMemo, useState } from "react";
import { formatDate } from "../utils/formatDate";

// Build dropdown label for one harvest.
const buildHarvestOptionLabel = (harvest) => {
  if (!harvest) return "N/A";

  const dateText = formatDate(harvest.harvestDate);
  const harvestNumberText = harvest.harvestNumber || "No Number";
  const locationText = harvest.locationId?.nickname || "No Location";

  const rooms = Array.isArray(harvest.rooms) ? harvest.rooms : [];
  const roomNames = rooms
    .map((roomEntry) => roomEntry?.roomId?.name)
    .filter(Boolean)
    .join(", ");

  return `${dateText} — ${harvestNumberText} — ${locationText} — ${roomNames || "No Rooms"}`;
};

function HarvestReportPage({ harvests }) {
  const [selectedHarvestId, setSelectedHarvestId] = useState("");
  const [expandedRows, setExpandedRows] = useState({});

  // Show newest harvests first.
  const sortedHarvests = useMemo(() => {
    if (!Array.isArray(harvests)) return [];
    return [...harvests].sort(
      (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
    );
  }, [harvests]);

  // Keep current selection, otherwise default to newest harvest.
  const effectiveSelectedHarvestId = useMemo(() => {
    if (sortedHarvests.length === 0) return "";
    const stillExists = sortedHarvests.some((h) => h._id === selectedHarvestId);
    if (selectedHarvestId && stillExists) return selectedHarvestId;
    return sortedHarvests[0]._id;
  }, [selectedHarvestId, sortedHarvests]);

  const selectedHarvest = useMemo(
    () =>
      sortedHarvests.find(
        (harvest) => harvest._id === effectiveSelectedHarvestId,
      ),
    [effectiveSelectedHarvestId, sortedHarvests],
  );

  // Build room sections and strain rows for display.
  const roomSections = useMemo(() => {
    if (!selectedHarvest || !Array.isArray(selectedHarvest.rooms)) return [];

    const sections = [];

    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      const roomId = roomEntry?.roomId;
      const roomName = roomId?.name || "N/A";
      const roomType = roomId?.type || "N/A";
      const roomSqFoot = roomId?.sqFoot ?? "N/A";
      const roomSectionKey = `${selectedHarvest._id}-room-${roomIndex}`;

      const strains = Array.isArray(roomEntry?.strains)
        ? roomEntry.strains
        : [];

      const strainRows = strains.map((strainEntry, strainIndex) => {
        const strainId = strainEntry?.strainId;
        const strainName = strainId?.name || "N/A";

        return {
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

  const roomNamesSummary = useMemo(
    () => roomSections.map((s) => s.roomName).join(", ") || "N/A",
    [roomSections],
  );

  const locationName = selectedHarvest?.locationId?.nickname || "N/A";

  const toggleExpandedRow = (rowKey) => {
    setExpandedRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  return (
    <div className="form-container">
      <h2>Harvest Report</h2>
      <p>Select a harvest date to view full room + strain details.</p>

      <div className="form-field">
        <label className="form-label" htmlFor="harvest-report-select">
          Harvest Date:
        </label>
        <select
          id="harvest-report-select"
          className="form-select"
          value={effectiveSelectedHarvestId}
          onChange={(e) => {
            setSelectedHarvestId(e.target.value);
            setExpandedRows({});
          }}
        >
          {sortedHarvests.length === 0 && <option value="">No harvests</option>}
          {sortedHarvests.map((harvest) => (
            <option key={harvest._id} value={harvest._id}>
              {buildHarvestOptionLabel(harvest)}
            </option>
          ))}
        </select>
      </div>

      {!selectedHarvest ? (
        <p>No harvest selected.</p>
      ) : (
        <>
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
              <h3>Total Strains</h3>
              <p>
                {roomSections.reduce(
                  (total, section) => total + section.strainRows.length,
                  0,
                )}
              </p>
            </div>
            <div className="strain-card">
              <h3>Total Plants</h3>
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
                          <Fragment key={row.key}>
                            <tr>
                              <td>
                                <button
                                  type="button"
                                  className="table-toggle-button"
                                  onClick={() => toggleExpandedRow(row.key)}
                                >
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

                            {expandedRows[row.key] && (
                              <tr className="harvest-detail-row">
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
                                        : row.totes
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
