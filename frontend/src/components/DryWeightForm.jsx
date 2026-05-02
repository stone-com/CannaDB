import { useState } from "react";

// onComplete is a function passed in from the parent (App.jsx).
// After a successful save, we call it so the parent can close the window
// and refresh the harvest list.
function DryWeightForm({ harvests, onComplete }) {
  const [selectedHarvestId, setSelectedHarvestId] = useState(""); // which harvest is picked in the dropdown
  const [selectedStrainKey, setSelectedStrainKey] = useState(null); // which strain row is highlighted on the left
  const [dryWeightInput, setDryWeightInput] = useState(""); // what the user has typed in the input box
  const [dryWeightsByKey, setDryWeightsByKey] = useState({}); // committed dry weights

  // Sort harvests newest-first so the most recent ones appear at the top of the dropdown.
  // We spread into a new array first ([...harvests]) because .sort() modifies the original array,
  // and we don't want to mutate the props that came from the parent.
  const sortedHarvests = Array.isArray(harvests)
    ? [...harvests].sort(
        (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
      )
    : [];

  // Look up the full harvest object that matches the selected ID.
  // .find() returns the first item that passes the test, or undefined if nothing matches.
  const selectedHarvest =
    sortedHarvests.find((harvest) => harvest._id === selectedHarvestId) || null;

  // Build a flat list of strain rows for the left-side picker.
  // A harvest has multiple rooms, and each room has multiple strains.
  // We loop through both levels and push one row object per strain into harvestStrains.
  // The "key" (e.g. "0-1") is roomIndex + strainIndex — it uniquely identifies each strain
  // and is also how we store its dry weight in dryWeightsByKey.
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

  // Find the full row object for whichever strain the user currently has selected.
  const selectedStrain =
    harvestStrains.find((entry) => entry.key === selectedStrainKey) || null;

  // Called when the user picks a different harvest from the dropdown.
  // We reset all other form state so the user starts clean with the new harvest.
  const handleHarvestChange = (e) => {
    setSelectedHarvestId(e.target.value);
    setSelectedStrainKey(null);
    setDryWeightInput("");
    setDryWeightsByKey({});
  };

  // Called when the user clicks a strain row on the left.
  // We just update which row is highlighted. The input stays empty
  // until the user types a value — nothing auto-fills.
  const handleStrainClick = (strainKey) => {
    setSelectedStrainKey(strainKey);
    setDryWeightInput("");
  };

  // Called when the user clicks "Set".
  // This is the only place a dry weight gets saved into dryWeightsByKey.
  // We validate first, then store the value under the strain's key.
  const handleSetDryWeight = () => {
    if (!selectedStrainKey) {
      return;
    }

    const parsed = Number(dryWeightInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      window.alert("Enter a valid dry weight in grams.");
      return;
    }

    // Spread the previous object and add/overwrite just this one key.
    // This keeps all other strains' values intact.
    setDryWeightsByKey((prev) => ({
      ...prev,
      [selectedStrainKey]: parsed,
    }));
  };

  // Called when the user clicks "Save Dry Weights".
  // We build an updated version of the harvest rooms/strains, then send it
  // to the backend via a PATCH request (partial update — only the fields we send change).
  const handleSubmit = async () => {
    if (!selectedHarvest) {
      window.alert("Please select a harvest.");
      return;
    }

    try {
      // Rebuild the rooms array from the original harvest data.
      // For each strain, we use the committed dry weight from dryWeightsByKey if available,
      // otherwise fall back to whatever was already saved on the harvest.
      const updatedRooms = (selectedHarvest.rooms || []).map(
        (roomEntry, roomIndex) => ({
          // roomId is a populated object from MongoDB — we only need to send the ID string.
          roomId: roomEntry?.roomId?._id,
          strains: (roomEntry?.strains || []).map(
            (strainEntry, strainIndex) => {
              // Build the key so we know which dry weight to look up.
              const key = `${roomIndex}-${strainIndex}`;

              // Use committed dry weight if available; fall back to what's already saved on the harvest.
              const dryWeightValue =
                dryWeightsByKey[key] ?? strainEntry?.totalDryWeightGrams ?? 0;

              return {
                strainId: strainEntry?.strainId?._id,
                plantCount: strainEntry?.plantCount || 0,
                // Preserve the original wet weight totes — we are only updating dry weight here.
                totes: (strainEntry?.totes || []).map((tote) => ({
                  wetWeight: tote?.wetWeight || 0,
                })),
                totalDryWeightGrams: Number(dryWeightValue) || 0,
              };
            },
          ),
        }),
      );

      // Send the updated rooms to the backend.
      // PATCH means "update only these fields" — we are just changing the rooms array.
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

      // Tell the parent the save is done so it can close the window and refresh data.
      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      window.alert(`Error: ${error.message}`);
    }
  };

  // The dry weight currently shown on the right panel for the selected strain.
  // undefined means the user hasn't committed a value for it yet.
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
            {/* .map() turns the array of harvests into an array of <option> elements. */}
            {sortedHarvests.map((harvest) => {
              // Build a readable label for each dropdown option.
              const date = new Date(harvest?.harvestDate);
              const dateText = Number.isNaN(date.getTime())
                ? "N/A"
                : date.toLocaleDateString();
              const harvestNumberText = harvest?.harvestNumber || "No Number";
              const locationText =
                harvest?.locationId?.nickname ||
                harvest?.locationId ||
                "No Location";
              const roomNames = (harvest?.rooms || [])
                .map(
                  (roomEntry) => roomEntry?.roomId?.name || roomEntry?.roomId,
                )
                .filter(Boolean)
                .join(", ");
              const label = `${dateText} - ${harvestNumberText} - ${locationText} - ${roomNames || "No Rooms"}`;

              // Each <option> needs a unique `key` so React can track them efficiently.
              // The `value` is what gets stored in selectedHarvestId when the user picks it.
              return (
                <option key={harvest._id} value={harvest._id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {/* Only show the strain list once a harvest has been chosen. */}
        {selectedHarvest && (
          <div className="harvest-strains-panel">
            <p className="harvest-strains-heading">
              {selectedHarvest.harvestNumber || "Harvest"} Strains
            </p>
            <div className="harvest-strains-list">
              {/* Render one button per strain. Clicking it selects that strain on the right. */}
              {harvestStrains.map((entry) => {
                // isActive is true when this row is the currently selected strain.
                // We use it to add an "active" CSS class that highlights the button.
                const isActive = selectedStrainKey === entry.key;

                // Show the committed dry weight badge, or "Not set" if the user hasn't entered one yet.
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
        {/* The right panel only shows content when a strain has been clicked on the left.
             If no strain is selected, we show a short hint message instead. */}
        {selectedStrain ? (
          <>
            <p className="harvest-active-strain">
              {selectedStrain.strainName} ({selectedStrain.roomName})
            </p>

            <div className="form-field">
              <label className="form-label">Total Dry Weight (grams)</label>
              <div className="harvest-tote-input-row">
                {/* Controlled input — its value is always tied to dryWeightInput state.
                     onChange updates the state as the user types. */}
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={dryWeightInput}
                  onChange={(e) => setDryWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Allow pressing Enter as a shortcut instead of clicking Set.
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

            {/* Show the committed value (set via the Set button) for this strain. */}
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
