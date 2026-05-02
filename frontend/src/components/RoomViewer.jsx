import { useMemo, useState } from "react";

// Formats a date value, returning "N/A" for nulls or invalid dates.
const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
};

// Shows a room dropdown and displays the plants in that room's active batch.
function RoomViewer({ rooms, batches }) {
  // Which location the user has selected. Empty string = nothing chosen yet.
  const [selectedLocationId, setSelectedLocationId] = useState("");
  // Which room the user has selected. Empty string = nothing chosen yet.
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const allRooms = Array.isArray(rooms) ? rooms : [];

  const sortedLocations = useMemo(() => {
    const locations = allRooms
      .map((room) => room?.locationId)
      .filter((location) => location?._id)
      .filter(
        (location, index, arr) =>
          arr.findIndex(
            (candidate) => String(candidate._id) === String(location._id),
          ) === index,
      );

    return locations.sort((a, b) =>
      (a?.nickname || "").localeCompare(b?.nickname || ""),
    );
  }, [allRooms]);

  // Rooms filtered by selected location, then sorted by room name.
  const filteredRooms = useMemo(() => {
    if (!selectedLocationId) return [];
    return allRooms
      .filter(
        (room) => String(room.locationId?._id) === String(selectedLocationId),
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allRooms, selectedLocationId]);

  const handleLocationChange = (e) => {
    setSelectedLocationId(e.target.value);
    setSelectedRoomId("");
  };

  // Full room object for the current selection.
  const selectedRoom = useMemo(
    () => filteredRooms.find((r) => r._id === selectedRoomId),
    [filteredRooms, selectedRoomId],
  );

  // The batch in the selected room (find which batch has this room in its rooms array).
  const batch = useMemo(() => {
    if (!selectedRoom) return null;
    return (
      (Array.isArray(batches) &&
        batches.find(
          (b) =>
            Array.isArray(b.rooms) &&
            b.rooms.some((r) => String(r.roomId) === String(selectedRoom._id)),
        )) ||
      null
    );
  }, [selectedRoom, batches]);

  // One row per plant entry for the selected room specifically.
  const plantRows = useMemo(() => {
    if (!batch || !Array.isArray(batch.rooms)) return [];
    const roomEntry = batch.rooms.find(
      (r) => String(r.roomId) === String(selectedRoomId),
    );
    if (!roomEntry || !Array.isArray(roomEntry.plants)) return [];
    return roomEntry.plants.map((entry) => ({
      strainName: entry.strainId?.name || "Unknown Strain",
      strainType: entry.strainId?.type || "N/A",
      count: Number(entry.count) || 0,
    }));
  }, [batch, selectedRoomId]);

  // Sum of all plant counts across strains.
  const totalPlants = useMemo(
    () => plantRows.reduce((sum, row) => sum + row.count, 0),
    [plantRows],
  );

  return (
    <div className="room-viewer">
      {/* Room selector */}
      <div className="room-viewer-selector">
        <label
          htmlFor="room-viewer-location-select"
          className="room-viewer-label"
        >
          Select Location
        </label>
        <select
          id="room-viewer-location-select"
          className="room-viewer-select"
          value={selectedLocationId}
          onChange={handleLocationChange}
        >
          <option value="">— Choose a location —</option>
          {sortedLocations.map((location) => (
            <option key={location._id} value={location._id}>
              {location.nickname || "Unnamed Location"}
            </option>
          ))}
        </select>
      </div>

      <div className="room-viewer-selector">
        <label htmlFor="room-viewer-select" className="room-viewer-label">
          Select Room
        </label>
        <select
          id="room-viewer-select"
          className="room-viewer-select"
          value={selectedRoomId}
          disabled={!selectedLocationId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
        >
          <option value="">— Choose a room —</option>
          {filteredRooms.map((room) => (
            <option key={room._id} value={room._id}>
              {room.name}
              {room.type ? ` (${room.type})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Nothing selected yet */}
      {!selectedRoom && (
        <p className="room-viewer-empty">
          Choose a room above to view its current contents.
        </p>
      )}

      {/* Room selected but no batch assigned */}
      {selectedRoom && !batch && (
        <div className="room-viewer-no-batch">
          <p>
            <strong>{selectedRoom.name}</strong> has no active batch assigned.
          </p>
        </div>
      )}

      {/* Room selected and batch exists */}
      {selectedRoom && batch && (
        <div className="room-viewer-content">
          {/* Batch summary cards */}
          <div className="room-viewer-meta">
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Batch</span>
              <span className="room-viewer-meta-value">
                {batch.batchNumber || "N/A"}
              </span>
            </div>
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Clone Date</span>
              <span className="room-viewer-meta-value">
                {formatDate(batch.cloneDate)}
              </span>
            </div>
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Harvest Date</span>
              <span className="room-viewer-meta-value">
                {formatDate(batch.harvestDate)}
              </span>
            </div>
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Total Plants</span>
              <span className="room-viewer-meta-value">{totalPlants}</span>
            </div>
          </div>

          {/* Plants table */}
          {plantRows.length === 0 ? (
            <p className="room-viewer-empty">
              No plants recorded in this batch.
            </p>
          ) : (
            <table className="room-viewer-table">
              <thead>
                <tr>
                  <th>Strain</th>
                  <th>Type</th>
                  <th>Plant Count</th>
                  <th>% of Room</th>
                </tr>
              </thead>
              <tbody>
                {plantRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.strainName}</td>
                    <td>{row.strainType}</td>
                    <td>{row.count}</td>
                    <td>
                      {totalPlants > 0
                        ? `${((row.count / totalPlants) * 100).toFixed(1)}%`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default RoomViewer;
