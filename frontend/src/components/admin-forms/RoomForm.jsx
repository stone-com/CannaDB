import { useEffect, useMemo, useState } from "react";

// Constant outside component — never changes, no need to recreate per render.
const ROOM_TYPES = [
  "Flower",
  "Veg",
  "Mom",
  "Clone",
  "Culture",
  "Inventory",
  "Packaging",
  "Storage",
  "Drying",
];

// `section="add"` renders the create-room form.
// `section="assign"` renders the batch assignment form.
// `embedded={true}` skips the wrapper div/heading (for AdminPanel accordion use).
function RoomForm({ embedded, section }) {
  // State for dropdown data and form values.
  const [locations, setLocations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [formData, setFormData] = useState({
    locationId: "",
    name: "",
    type: "",
    sqFoot: "",
  });
  const [assignmentData, setAssignmentData] = useState({
    roomId: "",
    batchId: "",
  });
  const [message, setMessage] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  // Loads location options for the room form dropdown.
  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  // Loads rooms so the assignment dropdown can target a room record.
  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  // Loads batches used by room assignment section.
  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  // Date formatting helper for batch labels.
  const formatDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString();
  };

  // Filters out past-harvest batches and sorts by nearest harvest date.
  const selectableBatches = useMemo(() => {
    const now = new Date();

    return [...batches]
      .filter((batch) => {
        if (!batch?.harvestDate) return true;
        const harvestDate = new Date(batch.harvestDate);
        if (Number.isNaN(harvestDate.getTime())) return true;
        return harvestDate >= now;
      })
      .sort((a, b) => {
        const aDate = a?.harvestDate ? new Date(a.harvestDate).getTime() : 0;
        const bDate = b?.harvestDate ? new Date(b.harvestDate).getTime() : 0;
        return aDate - bDate;
      });
  }, [batches]);

  useEffect(() => {
    fetchLocations();
    fetchRooms();
    fetchBatches();

    const handleLocationCreated = () => {
      fetchLocations();
      fetchRooms();
      fetchBatches();
    };

    const handleRoomOrBatchUpdated = () => {
      fetchRooms();
      fetchBatches();
    };

    window.addEventListener("location:created", handleLocationCreated);
    window.addEventListener("room:created", handleRoomOrBatchUpdated);
    window.addEventListener("batch:created", handleRoomOrBatchUpdated);

    return () => {
      window.removeEventListener("location:created", handleLocationCreated);
      window.removeEventListener("room:created", handleRoomOrBatchUpdated);
      window.removeEventListener("batch:created", handleRoomOrBatchUpdated);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: formData.locationId,
          name: formData.name,
          type: formData.type,
          sqFoot: formData.sqFoot ? Number(formData.sqFoot) : null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add room");
      }

      const savedRoom = await res.json();

      window.dispatchEvent(
        new CustomEvent("room:created", {
          detail: savedRoom,
        }),
      );

      setFormData({ locationId: "", name: "", type: "", sqFoot: "" });
      setMessage("Room added successfully.");
      fetchRooms();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  // Updates a room's current batch assignment.
  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    setAssignmentMessage("");

    try {
      if (!assignmentData.roomId) {
        throw new Error("Please select a room");
      }

      const payload = {
        batchId: assignmentData.batchId || null,
      };

      const res = await fetch(`/api/rooms/${assignmentData.roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to assign batch to room");
      }

      const updatedRoom = await res.json();

      window.dispatchEvent(
        new CustomEvent("room:created", {
          detail: updatedRoom,
        }),
      );

      setAssignmentMessage("Room batch assignment saved.");
      fetchRooms();
    } catch (error) {
      setAssignmentMessage(`Error: ${error.message}`);
    }
  };

  if (embedded && section === "add") {
    return (
      <>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">
              Location (required):
              <select
                className="form-select"
                value={formData.locationId}
                onChange={(e) =>
                  setFormData({ ...formData, locationId: e.target.value })
                }
                required
              >
                <option value="">-- Select Location --</option>
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.nickname}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-field">
            <label className="form-label">
              Room Name (required):
              <input
                className="form-input"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </label>
          </div>
          <div className="form-field">
            <label className="form-label">
              Room Type (required):
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                required
              >
                <option value="">-- Select Room Type --</option>
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-field">
            <label className="form-label">
              Square Feet:
              <input
                className="form-input"
                type="number"
                min="0"
                value={formData.sqFoot}
                onChange={(e) =>
                  setFormData({ ...formData, sqFoot: e.target.value })
                }
              />
            </label>
          </div>
          <button className="submit-button" type="submit">
            Add Room
          </button>
        </form>
        {message && <p className="status-message">{message}</p>}
      </>
    );
  }

  if (embedded && section === "assign") {
    return (
      <>
        <form onSubmit={handleAssignmentSubmit}>
          <div className="form-field">
            <label className="form-label">
              Room (required):
              <select
                className="form-select"
                value={assignmentData.roomId}
                onChange={(e) =>
                  setAssignmentData({
                    ...assignmentData,
                    roomId: e.target.value,
                  })
                }
                required
              >
                <option value="">-- Select Room --</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {/* room.locationId?.nickname uses optional chaining (?.).
                        The ?. means: "if locationId exists, access .nickname —
                        if locationId is null or undefined, don't crash, just return undefined."
                        The || fallback then kicks in and shows 'Unknown Location' instead. */}
                    {room.locationId?.nickname || "Unknown Location"} -{" "}
                    {room.name} ({room.type})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-field">
            <label className="form-label">
              Batch:
              <select
                className="form-select"
                value={assignmentData.batchId}
                onChange={(e) =>
                  setAssignmentData({
                    ...assignmentData,
                    batchId: e.target.value,
                  })
                }
              >
                <option value="">-- No Batch (Unassign) --</option>
                {selectableBatches.map((batch) => (
                  <option key={batch._id} value={batch._id}>
                    {batch.batchNumber} | Clone: {formatDate(batch.cloneDate)} |
                    Harvest: {formatDate(batch.harvestDate)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="submit-button" type="submit">
            Save Assignment
          </button>
        </form>
        {assignmentMessage && (
          <p className="status-message">{assignmentMessage}</p>
        )}
      </>
    );
  }

  return (
    <div className="form-container">
      <h2>Add Room</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label">
            Location (required):
            <select
              className="form-select"
              value={formData.locationId}
              onChange={(e) =>
                setFormData({ ...formData, locationId: e.target.value })
              }
              required
            >
              <option value="">-- Select Location --</option>
              {locations.map((location) => (
                <option key={location._id} value={location._id}>
                  {location.nickname}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Room Name (required):
            <input
              className="form-input"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Room Type (required):
            <select
              className="form-select"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              required
            >
              <option value="">-- Select Room Type --</option>
              {ROOM_TYPES.map((roomType) => (
                <option key={roomType} value={roomType}>
                  {roomType}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Square Feet:
            <input
              className="form-input"
              type="number"
              min="0"
              value={formData.sqFoot}
              onChange={(e) =>
                setFormData({ ...formData, sqFoot: e.target.value })
              }
            />
          </label>
        </div>

        <button className="submit-button" type="submit">
          Add Room
        </button>
      </form>
      {message && <p className="status-message">{message}</p>}

      <hr />

      <h2>Assign Batch To Room</h2>
      <form onSubmit={handleAssignmentSubmit}>
        <div className="form-field">
          <label className="form-label">
            Room (required):
            <select
              className="form-select"
              value={assignmentData.roomId}
              onChange={(e) =>
                setAssignmentData({ ...assignmentData, roomId: e.target.value })
              }
              required
            >
              <option value="">-- Select Room --</option>
              {rooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.locationId?.nickname || "Unknown Location"} -{" "}
                  {room.name} ({room.type})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Batch:
            <select
              className="form-select"
              value={assignmentData.batchId}
              onChange={(e) =>
                setAssignmentData({
                  ...assignmentData,
                  batchId: e.target.value,
                })
              }
            >
              <option value="">-- No Batch (Unassign) --</option>
              {selectableBatches.map((batch) => (
                <option key={batch._id} value={batch._id}>
                  {batch.batchNumber} | Clone: {formatDate(batch.cloneDate)} |
                  Harvest: {formatDate(batch.harvestDate)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="submit-button" type="submit">
          Save Assignment
        </button>
      </form>
      {assignmentMessage && (
        <p className="status-message">{assignmentMessage}</p>
      )}
    </div>
  );
}

export default RoomForm;
