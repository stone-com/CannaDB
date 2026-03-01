import { useEffect, useState } from "react";

// Constant arrays are useful for dropdown options that don't change.
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

function RoomForm() {
  // State for dropdown data and form values.
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState({
    locationId: "",
    name: "",
    type: "",
    sqFoot: "",
  });
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    // Effect for initial load + event subscription.
    // Initial location dropdown load.
    fetchLocations();

    // Listen for location creation events to keep dropdown options current.
    const handleLocationCreated = () => {
      fetchLocations();
    };

    window.addEventListener("location:created", handleLocationCreated);

    return () => {
      window.removeEventListener("location:created", handleLocationCreated);
    };
  }, []);

  const handleSubmit = async (e) => {
    // Create a room record linked to a location by locationId.
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
          // Convert string input to number before sending.
          sqFoot: formData.sqFoot ? Number(formData.sqFoot) : null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add room");
      }

      const savedRoom = await res.json();

      // Notify forms that depend on rooms (for example, HarvestForm).
      window.dispatchEvent(
        new CustomEvent("room:created", {
          detail: savedRoom,
        }),
      );

      setFormData({ locationId: "", name: "", type: "", sqFoot: "" });
      setMessage("Room added successfully.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

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
    </div>
  );
}

export default RoomForm;
