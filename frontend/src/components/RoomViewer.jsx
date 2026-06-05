import { useMemo, useState } from "react";
import { formatDate } from "../utils/formatDate";

// Show active batch and plant data for one room.
function RoomViewer({ rooms, roomAssignments }) {
  // Selected location.
  const [selectedLocationId, setSelectedLocationId] = useState("");
  // Selected room.
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const allRooms = useMemo(() => (Array.isArray(rooms) ? rooms : []), [rooms]);
  const assignments = useMemo(
    () => (Array.isArray(roomAssignments) ? roomAssignments : []),
    [roomAssignments],
  );

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

  // Rooms in selected location.
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

  // Assignments for selected room.
  const selectedRoomAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          String(assignment?.roomId?._id) === String(selectedRoomId),
      ),
    [assignments, selectedRoomId],
  );

  const selectedRoom =
    filteredRooms.find((room) => String(room._id) === String(selectedRoomId)) ||
    null;

  const roomTotalPlants = useMemo(() => {
    return selectedRoomAssignments.reduce((sum, assignment) => {
      const assignedPlants = Array.isArray(assignment?.assignedPlants)
        ? assignment.assignedPlants
        : [];

      return (
        sum +
        assignedPlants.reduce(
          (innerSum, plant) => innerSum + (Number(plant?.count) || 0),
          0,
        )
      );
    }, 0);
  }, [selectedRoomAssignments]);

  return (
    <div className="room-viewer">
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

      {!selectedRoom && (
        <p className="room-viewer-empty">
          Choose a room above to view its current contents.
        </p>
      )}

      {selectedRoom && selectedRoomAssignments.length === 0 && (
        <div className="room-viewer-no-batch">
          <p>
            <strong>{selectedRoom.name}</strong> has no active batch assigned.
          </p>
        </div>
      )}

      {selectedRoom && selectedRoomAssignments.length > 0 && (
        <div className="room-viewer-content">
          <div className="room-viewer-meta">
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Room</span>
              <span className="room-viewer-meta-value">
                {selectedRoom.name}
              </span>
            </div>
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Type</span>
              <span className="room-viewer-meta-value">
                {selectedRoom.type || "N/A"}
              </span>
            </div>
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Total Plants</span>
              <span className="room-viewer-meta-value">{roomTotalPlants}</span>
            </div>
            <div className="room-viewer-meta-card">
              <span className="room-viewer-meta-label">Active Batches</span>
              <span className="room-viewer-meta-value">
                {selectedRoomAssignments.length}
              </span>
            </div>
          </div>

          {selectedRoomAssignments.map((assignment) => {
            const batch = assignment.batchId;
            const assignedPlants = Array.isArray(assignment?.assignedPlants)
              ? assignment.assignedPlants
              : [];
            const strainRows = assignedPlants;
            const batchTotalPlants = strainRows.reduce(
              (sum, row) => sum + (Number(row.count) || 0),
              0,
            );

            return (
              <section key={assignment._id} className="room-viewer-assignment">
                <div className="room-viewer-meta">
                  <div className="room-viewer-meta-card">
                    <span className="room-viewer-meta-label">Batch</span>
                    <span className="room-viewer-meta-value">
                      {batch?.batchNumber || "N/A"}
                    </span>
                  </div>
                  <div className="room-viewer-meta-card">
                    <span className="room-viewer-meta-label">Type</span>
                    <span className="room-viewer-meta-value">
                      {batch?.batchType || "production"}
                    </span>
                  </div>
                  <div className="room-viewer-meta-card">
                    <span className="room-viewer-meta-label">Clone Date</span>
                    <span className="room-viewer-meta-value">
                      {formatDate(batch?.cloneDate)}
                    </span>
                  </div>
                  <div className="room-viewer-meta-card">
                    <span className="room-viewer-meta-label">Plants</span>
                    <span className="room-viewer-meta-value">
                      {batchTotalPlants}
                    </span>
                  </div>
                </div>

                {strainRows.length === 0 ? (
                  <p className="room-viewer-empty">
                    No plants recorded for this batch in the selected room.
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
                      {strainRows.map((row, i) => (
                        <tr key={`${assignment._id}-${i}`}>
                          <td>{row.strainId?.name || "Unknown Strain"}</td>
                          <td>{row.strainId?.type || "N/A"}</td>
                          <td>{row.count}</td>
                          <td>
                            {roomTotalPlants > 0
                              ? `${((Number(row.count) / roomTotalPlants) * 100).toFixed(1)}%`
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RoomViewer;
