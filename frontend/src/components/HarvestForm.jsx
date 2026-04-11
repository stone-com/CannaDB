import { useEffect, useState } from "react";

// HarvestForm is a two-panel intake form for recording a harvest.
// Left side: pick a batch and room, then see all strains in that batch.
// Right side: click a strain to enter wet weights per tote.
function HarvestForm() {
  const [batches, setBatches] = useState([]);
  const [rooms, setRooms] = useState([]);
  // These track which batch and room the user has picked.
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  // This is the strain currently selected in the right panel.
  const [selectedStrainId, setSelectedStrainId] = useState(null);
  // Stores tote weights by strain ID: { strainId: [weight, weight, ...] }.
  const [totes, setTotes] = useState({});
  const [weightInput, setWeightInput] = useState("");
  const [message, setMessage] = useState("");

  // Gets batches and rooms so the dropdowns have data to show.
  const fetchDependencies = async () => {
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

  useEffect(() => {
    fetchDependencies();
    window.addEventListener("room:created", fetchDependencies);
    window.addEventListener("batch:created", fetchDependencies);
    return () => {
      window.removeEventListener("room:created", fetchDependencies);
      window.removeEventListener("batch:created", fetchDependencies);
    };
  }, []);

  // Only show batches that haven't been linked to a harvest yet.
  const unharvestedBatches = batches.filter((b) => !b.harvestId);

  // These are helper values based on the currently selected IDs.
  const selectedBatch = batches.find((b) => b._id === selectedBatchId) || null;
  const selectedRoom = rooms.find((r) => r._id === selectedRoomId) || null;
  const selectedStrainPlant =
    selectedBatch?.plants.find((p) => p.strainId?._id === selectedStrainId) ||
    null;

  const totalPlants = selectedBatch
    ? selectedBatch.plants.reduce((sum, p) => sum + (p.count || 0), 0)
    : 0;

  // Totes and total for the currently selected strain.
  const activeTotes = selectedStrainId ? totes[selectedStrainId] || [] : [];
  const activeToteTotal = activeTotes.reduce((sum, w) => sum + w, 0);

  // Changing the batch clears old strain/tote work so data doesn't mix.
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
    // Skip invalid values so only real numbers get saved.
    if (isNaN(weight) || weight <= 0) return;
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

  // Builds one harvest payload and sends it to the backend.
  const handleSubmit = async () => {
    if (!selectedBatchId || !selectedRoomId) {
      setMessage("Please select a batch and a room.");
      return;
    }

    try {
      // For each strain in the batch, include plant count and all tote weights.
      const strainsPayload = (selectedBatch?.plants || []).map((plant) => ({
        strainId: plant.strainId?._id || plant.strainId,
        plantCount: plant.count,
        totes: (totes[plant.strainId?._id] || []).map((w) => ({
          wetWeight: w,
        })),
      }));

      // locationId can be an object or string depending on how room data is populated.
      const locationId =
        selectedRoom?.locationId?._id || selectedRoom?.locationId;

      // Create a simple unique harvest number.
      const harvestNumber = `${selectedBatch?.batchNumber}-${Date.now()}`;

      const payload = {
        batchId: selectedBatchId,
        locationId,
        harvestNumber,
        harvestDate: selectedBatch?.harvestDate || new Date().toISOString(),
        rooms: [{ roomId: selectedRoomId, strains: strainsPayload }],
      };

      // Save the harvest record to the API.
      const res = await fetch("/api/harvests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create harvest");
      }

      const savedHarvest = await res.json();
      // Tell the rest of the app to refresh harvest data.
      window.dispatchEvent(
        new CustomEvent("harvest:created", { detail: savedHarvest }),
      );

      // Clear the form after a successful save.
      setSelectedBatchId("");
      setSelectedRoomId("");
      setSelectedStrainId(null);
      setTotes({});
      setWeightInput("");
      setMessage("Harvest created successfully.");
      setTimeout(() => setMessage(""), 4000);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="harvest-intake-form">
      {/* ── Left panel ── */}
      <div className="harvest-intake-left">
        <h3 className="harvest-intake-title">Harvest Intake Form</h3>

        {/* Batch dropdown — only shows unharvested batches */}
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
                  {batch.batchNumber} — {dateStr}
                </option>
              );
            })}
          </select>
        </div>

        {/* Room dropdown */}
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

        {/* Strain list — appears once a batch is selected */}
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
        {message && <p className="status-message">{message}</p>}
      </div>

      {/* ── Right panel — tote entry for the active strain ── */}
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
                  onKeyDown={(e) => e.key === "Enter" && handleAddTote()}
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
