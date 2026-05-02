import { useState } from "react";

function DryWeightForm({ harvests, onComplete }) {
  // Selected harvest ID and currently highlighted strain key.
  const [selectedHarvestId, setSelectedHarvestId] = useState("");
  const [selectedStrainKey, setSelectedStrainKey] = useState(null);
  // Current dry weight input and the committed values map.
  const [dryWeightInput, setDryWeightInput] = useState("");
  const [dryWeightsByKey, setDryWeightsByKey] = useState({});

  // Sort newest-first.
  const sortedHarvests = Array.isArray(harvests)
    ? [...harvests].sort(
        (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
      )
    : [];

  const selectedHarvest =
    sortedHarvests.find((harvest) => harvest._id === selectedHarvestId) || null;

  // Flatten all room/strain entries into a key-indexed list for the picker.
  const harvestStrains = [];
  if (selectedHarvest && Array.isArray(selectedHarvest.rooms)) {
    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      const roomName = roomEntry?.roomId?.name || "Unknown";
      const strains = Array.isArray(roomEntry?.strains)
        ? roomEntry.strains
        : [];

      strains.forEach((strainEntry, strainIndex) => {
        harvestStrains.push({
          key: `${roomIndex}-${strainIndex}`,
          roomName,
          strainName: strainEntry?.strainId?.name || "Unknown",
          plantCount: strainEntry?.plantCount || 0,
        });
      });
    });
  }

  const selectedStrain =
    harvestStrains.find((entry) => entry.key === selectedStrainKey) || null;

  // Resets all sub-state when a new harvest is chosen.
  const handleHarvestChange = (e) => {
    setSelectedHarvestId(e.target.value);
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

  // PATCHes the harvest with updated dry weights for every strain.
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
        body: JSON.stringify({ rooms: updatedRooms }),
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

  const activeDryWeight = selectedStrain
    ? dryWeightsByKey[selectedStrain.key]
    : undefined;

  return (
    <div className="harvest-intake-form">
      <div className="harvest-intake-left">
        <h3 className="harvest-intake-title">Dry Weight Entry</h3>

        <div className="form-field">
          <label className="form-label">Harvest</label>
          <select
            className="form-select"
            value={selectedHarvestId}
            onChange={handleHarvestChange}
          >
            <option value="">-- Select Harvest --</option>
            {sortedHarvests.map((harvest) => {
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
              const label = `${dateText} - ${harvestNumberText} - ${locationText} - ${roomNames || "No Rooms"}`;

              return (
                <option key={harvest._id} value={harvest._id}>
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

        {selectedHarvestId && (
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
              : "Select a harvest to get started."}
          </p>
        )}
      </div>
    </div>
  );
}

export default DryWeightForm;
