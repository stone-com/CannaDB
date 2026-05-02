import { useEffect, useState } from "react";

function HarvestForm({ onComplete }) {
  // Source data loaded from API for dropdowns.
  const [batches, setBatches] = useState([]);
  const [rooms, setRooms] = useState([]);

  // User selections.
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedStrainId, setSelectedStrainId] = useState(null);

  // Tote weights keyed by strain ID. Example: { "strain123": [2600, 2550] }
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

  // Only show batches that don't have a harvest yet.
  const unharvestedBatches = batches.filter((b) => !b.harvestId);

  // Derived from state — not stored separately.
  const selectedBatch = batches.find((b) => b._id === selectedBatchId) || null;
  const selectedStrainPlant =
    selectedBatch?.plants.find((p) => p.strainId?._id === selectedStrainId) ||
    null;

  const totalPlants = selectedBatch
    ? selectedBatch.plants.reduce((sum, p) => sum + (p.count || 0), 0)
    : 0;

  // Totes and running total for the active strain.
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
    setSelectedStrainId(strainId);
    setWeightInput("");
  };

  const handleAddTote = () => {
    const weight = parseFloat(weightInput);
    if (Number.isNaN(weight) || weight <= 0) return;

    setTotes((prev) => ({
      ...prev,
      [selectedStrainId]: [...(prev[selectedStrainId] || []), weight],
    }));
    setWeightInput("");
  };

  const handleRemoveTote = (strainId, index) => {
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
      const strainsPayload = (selectedBatch?.plants || []).map((plant) => ({
        strainId: plant.strainId?._id,
        plantCount: plant.count,
        totes: (totes[plant.strainId?._id] || []).map((weight) => ({
          wetWeight: weight,
        })),
      }));

      const room = rooms.find((r) => r._id === selectedRoomId);
      const locationId = room?.locationId?._id;

      if (!locationId) {
        window.alert("Could not find location for selected room.");
        return;
      }

      const payload = {
        batchId: selectedBatchId,
        locationId,
        harvestNumber: `${selectedBatch?.batchNumber}-${Date.now()}`,
        harvestDate: selectedBatch?.harvestDate || new Date().toISOString(),
        rooms: [{ roomId: selectedRoomId, strains: strainsPayload }],
      };

      const res = await fetch("/api/harvests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create harvest");
      }

      await res.json();

      setSelectedBatchId("");
      setSelectedRoomId("");
      setSelectedStrainId(null);
      setTotes({});
      setWeightInput("");

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
