import { useMemo, useState } from "react";

function DryWeightForm({ harvests, onComplete }) {
  // Current selected batch/strain row.
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedStrainKey, setSelectedStrainKey] = useState(null);
  // Input value and saved dry weights.
  const [dryWeightInput, setDryWeightInput] = useState("");
  const [dryWeightsByKey, setDryWeightsByKey] = useState({});

  const sortedHarvests = useMemo(
    () =>
      Array.isArray(harvests)
        ? [...harvests].sort(
            (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
          )
        : [],
    [harvests],
  );

  const batchesForSelection = useMemo(
    () =>
      sortedHarvests.map((harvest) => ({
        batchId: harvest?.batchId?._id || "",
        batchNumber: harvest?.batchId?.batchNumber || "Unknown Batch",
        harvest,
      })),
    [sortedHarvests],
  );

  const selectedHarvest = useMemo(
    () =>
      batchesForSelection.find(
        (entry) => String(entry.batchId) === String(selectedBatchId),
      )?.harvest || null,
    [batchesForSelection, selectedBatchId],
  );

  const harvestStrains = useMemo(() => {
    if (!selectedHarvest || !Array.isArray(selectedHarvest.rooms)) {
      return [];
    }

    const rows = [];

    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      const roomName = roomEntry?.roomId?.name || "Unknown";
      const strains = Array.isArray(roomEntry?.strains)
        ? roomEntry.strains
        : [];

      strains.forEach((strainEntry, strainIndex) => {
        rows.push({
          key: `${roomIndex}-${strainIndex}`,
          roomName,
          strainName: strainEntry?.strainId?.name || "Unknown",
          plantCount: strainEntry?.plantCount || 0,
        });
      });
    });

    return rows;
  }, [selectedHarvest]);

  const selectedStrain = useMemo(
    () =>
      harvestStrains.find((entry) => entry.key === selectedStrainKey) || null,
    [harvestStrains, selectedStrainKey],
  );

  // Reset form state when batch changes.
  const handleBatchChange = (e) => {
    setSelectedBatchId(e.target.value);
    setSelectedStrainKey(null);
    setDryWeightInput("");
    setDryWeightsByKey({});
  };

  const handleStrainClick = (strainKey) => {
    setSelectedStrainKey(strainKey);
    setDryWeightInput("");
  };

  const handleSetDryWeight = () => {
    if (!selectedStrainKey) return;

    const parsed = Number(dryWeightInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      window.alert("Enter a valid dry weight in grams.");
      return;
    }

    setDryWeightsByKey((prev) => ({
      ...prev,
      [selectedStrainKey]: parsed,
    }));
  };

  // Save dry weights back to the harvest.
  const handleSubmit = async () => {
    if (!selectedHarvest) {
      window.alert("Please select a harvest.");
      return;
    }

    try {
      const updatedRooms = (selectedHarvest.rooms || []).map(
        (roomEntry, roomIndex) => ({
          roomId: roomEntry?.roomId?._id,
          strains: (roomEntry?.strains || []).map(
            (strainEntry, strainIndex) => {
              const key = `${roomIndex}-${strainIndex}`;
              const dryWeightValue =
                dryWeightsByKey[key] ?? strainEntry?.totalDryWeightGrams ?? 0;

              return {
                strainId: strainEntry?.strainId?._id,
                plantCount: strainEntry?.plantCount || 0,
                totes: (strainEntry?.totes || []).map((tote) => ({
                  wetWeight: tote?.wetWeight || 0,
                })),
                totalDryWeightGrams: Number(dryWeightValue) || 0,
              };
            },
          ),
        }),
      );

      const res = await fetch(`/api/harvests/${selectedHarvest._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooms: updatedRooms,
          finalizeDryWeights: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save dry weights");
      }

      await res.json();

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      window.alert(`Error: ${error.message}`);
    }
  };

  const activeDryWeight = useMemo(
    () => (selectedStrain ? dryWeightsByKey[selectedStrain.key] : undefined),
    [dryWeightsByKey, selectedStrain],
  );

  return (
    <div className="harvest-intake-form">
      <div className="harvest-intake-left">
        <h3 className="harvest-intake-title">Dry Weight Entry</h3>

        <div className="form-field">
          <label className="form-label">Batch</label>
          <select
            className="form-select"
            value={selectedBatchId}
            onChange={handleBatchChange}
          >
            <option value="">-- Select Batch --</option>
            {batchesForSelection.map(({ batchId, batchNumber, harvest }) => {
              const date = new Date(harvest?.harvestDate);
              const dateText = Number.isNaN(date.getTime())
                ? "N/A"
                : date.toLocaleDateString();
              const harvestNumberText = harvest?.harvestNumber || "No Number";
              const locationText =
                harvest?.locationId?.nickname || "No Location";
              const roomNames = (harvest?.rooms || [])
                .map((roomEntry) => roomEntry?.roomId?.name)
                .filter(Boolean)
                .join(", ");
              const label = `${batchNumber} - ${dateText} - ${harvestNumberText} - ${locationText} - ${roomNames || "No Rooms"}`;

              return (
                <option key={harvest._id} value={batchId}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {selectedHarvest && (
          <div className="harvest-strains-panel">
            <p className="harvest-strains-heading">
              {selectedHarvest.harvestNumber || "Harvest"} Strains
            </p>
            <div className="harvest-strains-list">
              {harvestStrains.map((entry) => {
                const isActive = selectedStrainKey === entry.key;
                const hasInputDryWeight =
                  dryWeightsByKey[entry.key] !== undefined;
                const dryWeight = hasInputDryWeight
                  ? `${dryWeightsByKey[entry.key]} g`
                  : "Not set";

                return (
                  <button
                    key={entry.key}
                    type="button"
                    className={`harvest-strain-row${isActive ? " active" : ""}`}
                    onClick={() => handleStrainClick(entry.key)}
                  >
                    <span>
                      {entry.strainName} ({entry.roomName}) - {entry.plantCount}{" "}
                      Plants
                    </span>
                    <span className="tote-badge">{dryWeight}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedBatchId && (
          <button
            type="button"
            className="submit-button"
            onClick={handleSubmit}
          >
            Save Dry Weights
          </button>
        )}
      </div>

      <div className="harvest-intake-right">
        {selectedStrain ? (
          <>
            <p className="harvest-active-strain">
              {selectedStrain.strainName} ({selectedStrain.roomName})
            </p>

            <div className="form-field">
              <label className="form-label">Total Dry Weight (grams)</label>
              <div className="harvest-tote-input-row">
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={dryWeightInput}
                  onChange={(e) => setDryWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSetDryWeight();
                    }
                  }}
                  placeholder="e.g. 1420"
                />
                <button
                  type="button"
                  className="submit-button"
                  onClick={handleSetDryWeight}
                >
                  Set
                </button>
              </div>
            </div>

            <div className="harvest-totes-list">
              <p className="harvest-tote-total">
                Current Dry Weight:{" "}
                <strong>
                  {activeDryWeight === undefined
                    ? "Not set"
                    : `${activeDryWeight} g`}
                </strong>
              </p>
            </div>
          </>
        ) : (
          <p className="harvest-intake-hint">
            {selectedHarvest
              ? "Click a strain on the left to enter dry weight."
              : "Select a batch to get started."}
          </p>
        )}
      </div>
    </div>
  );
}

export default DryWeightForm;
