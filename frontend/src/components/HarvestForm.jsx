import { useEffect, useState } from "react";

// HarvestForm creates a harvest record that links a batch to one or more rooms.
// It accepts an `embedded` prop — when true it skips the outer wrapper div and h2
// so it can live cleanly inside an accordion section in AdminPanel.
function HarvestForm({ embedded }) {
  // State for dropdown source data.
  const [batches, setBatches] = useState([]);
  const [rooms, setRooms] = useState([]);
  // State for controlled form values.
  const [formData, setFormData] = useState({
    batchId: "",
    roomId: "",
    harvestDate: "",
  });
  const [message, setMessage] = useState("");

  // Load related data required to build a valid harvest payload.
  const fetchDependencies = async () => {
    try {
      // Promise.all runs multiple async operations at the same time (in parallel).
      // Instead of waiting for batches to load, THEN waiting for rooms to load,
      // both requests go out simultaneously. This makes the page faster.
      // Promise.all returns a new Promise that resolves when ALL of them finish.
      const [batchRes, roomRes] = await Promise.all([
        fetch("/api/batches"),
        fetch("/api/rooms"),
      ]);
      // The [batchRes, roomRes] on the left is array destructuring:
      // Promise.all returns an array of results, and we unpack them into named variables.
      // Same thing here — parse both response bodies at the same time:
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
    // Effect runs once on mount because dependency array is empty.
    // Initial dropdown load.
    fetchDependencies();

    // Refresh harvest dependencies when related records are created.
    const handleDependencyCreated = () => {
      fetchDependencies();
    };

    window.addEventListener("room:created", handleDependencyCreated);
    window.addEventListener("batch:created", handleDependencyCreated);

    return () => {
      // Cleanup event listeners when component unmounts.
      window.removeEventListener("room:created", handleDependencyCreated);
      window.removeEventListener("batch:created", handleDependencyCreated);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      // Build the request payload step by step.
      // rooms shape must match the backend schema: [{ roomId, strains: [] }]
      const payload = {
        batchId: formData.batchId,
        // Ternary: if roomId has a value, wrap it in the expected array shape.
        //          if roomId is empty (user didn't pick one), use an empty array.
        rooms: formData.roomId
          ? [{ roomId: formData.roomId, strains: [] }]
          : [],
      };

      // Conditionally add harvestDate to the payload.
      // We only include it if the user actually picked a date.
      // If we always included it, the backend would receive an empty string
      // instead of nothing, which could cause validation errors.
      if (formData.harvestDate) {
        payload.harvestDate = formData.harvestDate;
      }

      const res = await fetch("/api/harvests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add harvest");
      }

      const savedHarvest = await res.json();

      // Tell the parent/data-viewer to refresh.
      window.dispatchEvent(
        new CustomEvent("harvest:created", {
          detail: savedHarvest,
        }),
      );

      setFormData({ batchId: "", roomId: "", harvestDate: "" });
      setMessage("Harvest added successfully.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  if (embedded) {
    return (
      <>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">
              Batch (required):
              <select
                className="form-select"
                value={formData.batchId}
                onChange={(e) =>
                  setFormData({ ...formData, batchId: e.target.value })
                }
                required
              >
                <option value="">-- Select Batch --</option>
                {batches.map((batch) => (
                  <option key={batch._id} value={batch._id}>
                    {batch.batchNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-field">
            <label className="form-label">
              Room:
              <select
                className="form-select"
                value={formData.roomId}
                onChange={(e) =>
                  setFormData({ ...formData, roomId: e.target.value })
                }
              >
                <option value="">-- Optional Room --</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-field">
            <label className="form-label">
              Harvest Date:
              <input
                className="form-input"
                type="date"
                value={formData.harvestDate}
                onChange={(e) =>
                  setFormData({ ...formData, harvestDate: e.target.value })
                }
              />
            </label>
          </div>
          <button className="submit-button" type="submit">
            Add Harvest
          </button>
        </form>
        {message && <p className="status-message">{message}</p>}
      </>
    );
  }

  return (
    <div className="form-container">
      <h2>Add Harvest</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label">
            Batch (required):
            <select
              className="form-select"
              value={formData.batchId}
              onChange={(e) =>
                setFormData({ ...formData, batchId: e.target.value })
              }
              required
            >
              <option value="">-- Select Batch --</option>
              {batches.map((batch) => (
                <option key={batch._id} value={batch._id}>
                  {batch.batchNumber}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Room:
            <select
              className="form-select"
              value={formData.roomId}
              onChange={(e) =>
                setFormData({ ...formData, roomId: e.target.value })
              }
            >
              <option value="">-- Optional Room --</option>
              {rooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Harvest Date:
            <input
              className="form-input"
              type="date"
              value={formData.harvestDate}
              onChange={(e) =>
                setFormData({ ...formData, harvestDate: e.target.value })
              }
            />
          </label>
        </div>

        <button className="submit-button" type="submit">
          Add Harvest
        </button>
      </form>
      {message && <p className="status-message">{message}</p>}
    </div>
  );
}

export default HarvestForm;
