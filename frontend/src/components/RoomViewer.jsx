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
  // Which room the user has selected. Empty string = nothing chosen yet.
  const [selectedRoomId, setSelectedRoomId] = useState("");

  // Rooms sorted alphabetically for the dropdown.
  const sortedRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return [];
    return [...rooms].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [rooms]);

  // Full room object for the current selection.
  const selectedRoom = useMemo(
    () => sortedRooms.find((r) => r._id === selectedRoomId),
    [sortedRooms, selectedRoomId],
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
        <label htmlFor="room-viewer-select" className="room-viewer-label">
          Select Room
        </label>
        <select
          id="room-viewer-select"
          className="room-viewer-select"
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
        >
          <option value="">— Choose a room —</option>
          {sortedRooms.map((room) => (
            <option key={room._id} value={room._id}>
              {room.name}
              {room.locationId?.nickname
                ? ` · ${room.locationId.nickname}`
                : ""}
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
