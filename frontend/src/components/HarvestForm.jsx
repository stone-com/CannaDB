import { useEffect, useState } from "react";

// High-level flow:
// 1) Load batches + rooms
// 2) User picks a batch and room
// 3) User selects a strain and logs tote weights
// 4) Submit sends one harvest payload to the backend
// onComplete is a function passed down from the parent component (App).
// After a successful save, we call it so the parent can close the window,
// refresh parent data, and show any success UI.
function HarvestForm({ onComplete }) {
  // Source data loaded from API for dropdowns.
  const [batches, setBatches] = useState([]);
  const [rooms, setRooms] = useState([]);

  // User selections in the form.
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedStrainId, setSelectedStrainId] = useState(null);

  // Tote weights are stored by strain ID.
  // Example: { "strain123": [2600, 2550], "strainABC": [3100] }
  const [totes, setTotes] = useState({});
  const [weightInput, setWeightInput] = useState("");

  // Load batches and rooms once when the form opens.
  useEffect(() => {
    const loadData = async () => {
      try {
        const [batchRes, roomRes] = await Promise.all([
          fetch("/api/batches"),
          fetch("/api/rooms"),
        ]);
        const [batchData, roomData] = await Promise.all([
          batchRes.json(),
          roomRes.json(),
        ]);
        setBatches(Array.isArray(batchData) ? batchData : []);
        setRooms(Array.isArray(roomData) ? roomData : []);
      } catch (error) {
        console.error("Error fetching harvest form data:", error);
      }
    };

    loadData();
  }, []);

  // Only show batches that are not already connected to a harvest.
  const unharvestedBatches = batches.filter((b) => !b.harvestId);

  // These are "derived" values (calculated from state), not separate stored state.
  const selectedBatch = batches.find((b) => b._id === selectedBatchId) || null;
  const selectedStrainPlant =
    selectedBatch?.plants.find((p) => p.strainId?._id === selectedStrainId) ||
    null;

  const totalPlants = selectedBatch
    ? selectedBatch.plants.reduce((sum, p) => sum + (p.count || 0), 0)
    : 0;

  // Totes and total for the currently selected strain on the right panel.
  const activeTotes = selectedStrainId ? totes[selectedStrainId] || [] : [];
  const activeToteTotal = activeTotes.reduce((sum, w) => sum + w, 0);

  // When batch changes, clear strain/tote work from the previous batch.
  const handleBatchChange = (e) => {
    setSelectedBatchId(e.target.value);
    setSelectedStrainId(null);
    setTotes({});
    setWeightInput("");
  };

  const handleStrainClick = (strainId) => {
    // Changing strains resets the input box, but keeps previously entered totes.
    setSelectedStrainId(strainId);
    setWeightInput("");
  };

  const handleAddTote = () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;

    // Add one tote weight to the currently selected strain.
    setTotes((prev) => ({
      ...prev,
      [selectedStrainId]: [...(prev[selectedStrainId] || []), weight],
    }));
    setWeightInput("");
  };

  const handleRemoveTote = (strainId, index) => {
    // Remove exactly one tote row by index.
    setTotes((prev) => ({
      ...prev,
      [strainId]: prev[strainId].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    if (!selectedBatchId || !selectedRoomId) {
      window.alert("Please select a batch and a room.");
      return;
    }

    try {
      // Convert UI state into the backend's nested harvest shape.
      const strainsPayload = (selectedBatch?.plants || []).map((plant) => ({
        strainId: plant.strainId?._id,
        plantCount: plant.count,
        totes: (totes[plant.strainId?._id] || []).map((weight) => ({
          wetWeight: weight,
        })),
      }));

      const room = rooms.find((r) => r._id === selectedRoomId);
      const locationId = room?.locationId?._id;

      // We need locationId because the Harvest schema requires it.
      if (!locationId) {
        window.alert("Could not find location for selected room.");
        return;
      }

      // Final object sent to POST /api/harvests.
      const payload = {
        batchId: selectedBatchId,
        locationId,
        harvestNumber: `${selectedBatch?.batchNumber}-${Date.now()}`,
        harvestDate: selectedBatch?.harvestDate || new Date().toISOString(),
        rooms: [{ roomId: selectedRoomId, strains: strainsPayload }],
      };

      // Save harvest to backend.
      const res = await fetch("/api/harvests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create harvest");
      }

      // Read response body (not used further here, but keeps flow explicit).
      await res.json();

      // Reset form after save.
      setSelectedBatchId("");
      setSelectedRoomId("");
      setSelectedStrainId(null);
      setTotes({});
      setWeightInput("");

      // Call the parent callback if it was provided.
      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      window.alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="harvest-intake-form">
      <div className="harvest-intake-left">
        <h3 className="harvest-intake-title">Harvest Intake Form</h3>

        {/* Step 1: pick the batch */}
        <div className="form-field">
          <label className="form-label">Batch</label>
          <select
            className="form-select"
            value={selectedBatchId}
            onChange={handleBatchChange}
          >
            <option value="">-- Select Batch --</option>
            {unharvestedBatches.map((batch) => {
              const dateStr = batch.harvestDate
                ? new Date(batch.harvestDate).toLocaleDateString()
                : "No date set";
              return (
                <option key={batch._id} value={batch._id}>
                  {batch.batchNumber} - {dateStr}
                </option>
              );
            })}
          </select>
        </div>

        {/* Step 2: pick the room where harvest happened */}
        <div className="form-field">
          <label className="form-label">Harvest Room</label>
          <select
            className="form-select"
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
          >
            <option value="">-- Select Room --</option>
            {rooms.map((room) => (
              <option key={room._id} value={room._id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: show all strains in that batch and choose one to log totes */}
        {selectedBatch && (
          <div className="harvest-strains-panel">
            <p className="harvest-strains-heading">
              {selectedBatch.batchNumber} Strains
            </p>
            <div className="harvest-strains-list">
              {selectedBatch.plants.map((plant) => {
                const strainId = plant.strainId?._id;
                const strainName = plant.strainId?.name || "Unknown";
                const toteCount = (totes[strainId] || []).length;
                const isActive = selectedStrainId === strainId;
                return (
                  <button
                    key={strainId}
                    type="button"
                    className={`harvest-strain-row${isActive ? " active" : ""}`}
                    onClick={() => handleStrainClick(strainId)}
                  >
                    <span>
                      {strainName} &mdash; {plant.count} Plants
                    </span>
                    {toteCount > 0 && (
                      <span className="tote-badge">
                        {toteCount} tote{toteCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="harvest-total-plants">
              Total Plants to Harvest: <strong>{totalPlants}</strong>
            </p>
          </div>
        )}

        {/* Step 4: allow submit only when required selections are made */}
        {selectedBatchId && selectedRoomId && (
          <button
            type="button"
            className="submit-button"
            onClick={handleSubmit}
          >
            Submit Harvest
          </button>
        )}
      </div>

      <div className="harvest-intake-right">
        {/* Right panel is interactive only after a strain is selected */}
        {selectedStrainPlant ? (
          <>
            <p className="harvest-active-strain">
              {selectedStrainPlant.strainId?.name} &mdash;{" "}
              {selectedStrainPlant.count} Plants
            </p>

            <div className="form-field">
              <label className="form-label">Enter Wet Weight (grams)</label>
              <div className="harvest-tote-input-row">
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTote();
                  }}
                  placeholder="e.g. 2660"
                />
                <button
                  type="button"
                  className="submit-button"
                  onClick={handleAddTote}
                >
                  Add
                </button>
              </div>
            </div>

            {activeTotes.length > 0 && (
              <div className="harvest-totes-list">
                {activeTotes.map((weight, i) => (
                  <div key={i} className="harvest-tote-row">
                    <span>
                      Tote {i + 1}: {weight.toLocaleString()} g
                    </span>
                    <button
                      type="button"
                      className="tote-remove-btn"
                      onClick={() => handleRemoveTote(selectedStrainId, i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <p className="harvest-tote-total">
                  Total: <strong>{activeToteTotal.toLocaleString()} g</strong>
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="harvest-intake-hint">
            {selectedBatch
              ? "Click a strain on the left to enter tote weights."
              : "Select a batch to get started."}
          </p>
        )}
      </div>
    </div>
  );
}

export default HarvestForm;
