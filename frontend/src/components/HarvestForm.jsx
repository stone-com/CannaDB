import { useEffect, useState } from "react";

function HarvestForm() {
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
      // Promise.all runs both API requests in parallel.
      const [batchRes, roomRes] = await Promise.all([
        fetch("/api/batches"),
        fetch("/api/rooms"),
      ]);

      // Then parse both JSON responses in parallel too.
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
    // Create a minimal harvest record (batch + optional room + optional date).
    // rooms shape must match backend schema: [{ roomId, strains: [...] }]
    e.preventDefault();
    setMessage("");

    try {
      // Build request payload from form state.
      const payload = {
        batchId: formData.batchId,
        rooms: formData.roomId
          ? [{ roomId: formData.roomId, strains: [] }]
          : [],
      };

      if (formData.harvestDate) {
        // Only include harvestDate when provided.
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
