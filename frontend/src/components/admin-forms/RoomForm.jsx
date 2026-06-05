import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../../utils/formatDate";

// Fixed room type options.
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

const MS_PER_DAY = 86400000;

const NEXT_STAGE_BY_BATCH_TYPE = {
  production: {
    Clone: "Veg",
    Veg: "Flower",
    Flower: "HarvestReady",
  },
  mom: {
    Clone: "Veg",
    Veg: "Mom",
  },
};

// `section` chooses add-room vs assign-room UI.
// `embedded` chooses inline vs card layout.
function RoomForm({ embedded, section }) {
  // Data and form state.
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
  const [assignmentMode, setAssignmentMode] = useState("whole");
  const [wholeRoomId, setWholeRoomId] = useState("");
  const [splitDestinations, setSplitDestinations] = useState([]);
  const [shouldAdvanceStage, setShouldAdvanceStage] = useState(false);
  const [message, setMessage] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  // Load locations for dropdown.
  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  // Load rooms for assignment targets.
  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  // Load batches for assignment section.
  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  // Hide harvested batches and sort by harvest date.
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

  const selectedBatch = useMemo(
    () =>
      selectableBatches.find(
        (batch) => String(batch._id) === String(assignmentData.batchId),
      ) || null,
    [selectableBatches, assignmentData.batchId],
  );

  const batchPlantTotals = useMemo(() => {
    if (!selectedBatch) return [];

    const totals = new Map();

    (selectedBatch.rooms || []).forEach((roomEntry) => {
      (roomEntry?.plants || []).forEach((plantEntry) => {
        const strainId = String(
          plantEntry?.strainId?._id || plantEntry?.strainId,
        );
        if (!strainId || strainId === "undefined") return;

        const strainName = plantEntry?.strainId?.name || "Unknown Strain";
        const current = totals.get(strainId) || {
          strainId,
          strainName,
          totalCount: 0,
        };

        current.totalCount += Number(plantEntry?.count) || 0;
        totals.set(strainId, current);
      });
    });

    return Array.from(totals.values());
  }, [selectedBatch]);

  const assignableRooms = useMemo(() => {
    if (!selectedBatch?.location) return rooms;

    return rooms.filter(
      (room) =>
        String(room?.locationId?._id) === String(selectedBatch.location),
    );
  }, [rooms, selectedBatch]);

  const nextStage = useMemo(() => {
    if (!selectedBatch) return null;
    const map =
      NEXT_STAGE_BY_BATCH_TYPE[selectedBatch.batchType] ||
      NEXT_STAGE_BY_BATCH_TYPE.production;
    return map[selectedBatch.lifecycleStage] || null;
  }, [selectedBatch]);

  const daysInStage = useMemo(() => {
    if (!selectedBatch?.stageStartedAt) return "N/A";
    const startedAt = new Date(selectedBatch.stageStartedAt);
    if (Number.isNaN(startedAt.getTime())) return "N/A";
    const days = Math.max(
      0,
      Math.floor((Date.now() - startedAt.getTime()) / MS_PER_DAY),
    );
    return `${days} day${days === 1 ? "" : "s"}`;
  }, [selectedBatch]);

  const createZeroCounts = () =>
    Object.fromEntries(batchPlantTotals.map((plant) => [plant.strainId, "0"]));

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

  // Save room assignment for selected batch.
  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    setAssignmentMessage("");

    try {
      if (!assignmentData.batchId) {
        throw new Error("Please select a batch");
      }

      let payload = {
        mode: assignmentMode,
        notes: null,
        advanceStage: shouldAdvanceStage,
      };

      if (assignmentMode === "whole") {
        if (!wholeRoomId) {
          throw new Error("Please select a destination room");
        }
        payload.roomId = wholeRoomId;
      } else {
        const normalizedAssignments = splitDestinations
          .filter((destination) => destination.roomId)
          .map((destination) => ({
            roomId: destination.roomId,
            plants: batchPlantTotals
              .map((plant) => ({
                strainId: plant.strainId,
                count: Number(destination.strainCounts?.[plant.strainId]) || 0,
              }))
              .filter((plant) => plant.count > 0),
          }))
          .filter((destination) => destination.plants.length > 0);

        if (normalizedAssignments.length === 0) {
          throw new Error("Please allocate plants to at least one room");
        }

        const totalsByStrain = Object.fromEntries(
          batchPlantTotals.map((plant) => [plant.strainId, 0]),
        );

        normalizedAssignments.forEach((destination) => {
          destination.plants.forEach((plant) => {
            totalsByStrain[plant.strainId] += plant.count;
          });
        });

        const hasMismatch = batchPlantTotals.some(
          (plant) => totalsByStrain[plant.strainId] !== plant.totalCount,
        );

        if (hasMismatch) {
          throw new Error(
            "Split counts must exactly match the full batch totals for each strain",
          );
        }

        payload.assignments = normalizedAssignments;
      }

      const res = await fetch(
        `/api/batches/${assignmentData.batchId}/assign-rooms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to assign batch to room");
      }

      const result = await res.json();

      window.dispatchEvent(
        new CustomEvent("batch:updated", { detail: result.batch }),
      );
      window.dispatchEvent(
        new CustomEvent("roomAssignment:created", {
          detail: result.assignments,
        }),
      );

      setAssignmentMessage("Batch room allocation saved.");
      setAssignmentData({ roomId: "", batchId: "" });
      setWholeRoomId("");
      setSplitDestinations([]);
      setShouldAdvanceStage(false);
      fetchBatches();
    } catch (error) {
      setAssignmentMessage(`Error: ${error.message}`);
    }
  };

  const handleBatchSelection = (batchId) => {
    setAssignmentData({ roomId: "", batchId });
    setWholeRoomId("");
    setShouldAdvanceStage(false);
    setSplitDestinations(
      batchId
        ? [
            {
              roomId: "",
              strainCounts: createZeroCounts(),
            },
          ]
        : [],
    );
  };

  const handleAddSplitDestination = () => {
    setSplitDestinations((prev) => [
      ...prev,
      {
        roomId: "",
        strainCounts: createZeroCounts(),
      },
    ]);
  };

  const handleRemoveSplitDestination = (index) => {
    setSplitDestinations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSplitRoomChange = (index, roomId) => {
    setSplitDestinations((prev) =>
      prev.map((destination, i) =>
        i === index ? { ...destination, roomId } : destination,
      ),
    );
  };

  const handleSplitCountChange = (index, strainId, value) => {
    const normalizedValue =
      value === "" ? "" : String(Math.max(0, Number(value) || 0));

    setSplitDestinations((prev) =>
      prev.map((destination, i) =>
        i === index
          ? {
              ...destination,
              strainCounts: {
                ...destination.strainCounts,
                [strainId]: normalizedValue,
              },
            }
          : destination,
      ),
    );
  };

  const getAllocatedCount = (strainId) =>
    splitDestinations.reduce(
      (sum, destination) =>
        sum + (Number(destination.strainCounts?.[strainId]) || 0),
      0,
    );

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
              Batch (required):
              <select
                className="form-select"
                value={assignmentData.batchId}
                onChange={(e) => handleBatchSelection(e.target.value)}
                required
              >
                <option value="">-- Select Batch --</option>
                {selectableBatches.map((batch) => (
                  <option key={batch._id} value={batch._id}>
                    {batch.batchNumber} | Clone: {formatDate(batch.cloneDate)} |
                    Harvest: {formatDate(batch.harvestDate)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedBatch && (
            <div className="form-field">
              <p className="status-message">
                Current Stage: <strong>{selectedBatch.lifecycleStage}</strong>
              </p>
              <p className="status-message">
                In Stage For: <strong>{daysInStage}</strong>
              </p>
              <p className="status-message">
                Next Stage: <strong>{nextStage || "N/A"}</strong>
              </p>
              <p className="status-message">
                Current Room Plan:{" "}
                <strong>
                  {(selectedBatch.rooms || []).length > 0
                    ? selectedBatch.rooms
                        .map((entry) => {
                          const room = rooms.find(
                            (candidate) =>
                              String(candidate._id) === String(entry.roomId),
                          );
                          return room?.name || "Unknown Room";
                        })
                        .join(", ")
                    : "No room plan set"}
                </strong>
              </p>
            </div>
          )}

          {selectedBatch && (
            <div className="form-field">
              <label className="form-label">
                <input
                  type="radio"
                  checked={assignmentMode === "whole"}
                  onChange={() => setAssignmentMode("whole")}
                />{" "}
                Whole batch to one room
              </label>
              <label className="form-label">
                <input
                  type="radio"
                  checked={assignmentMode === "split"}
                  onChange={() => setAssignmentMode("split")}
                />{" "}
                Split strains/plants across multiple rooms
              </label>

              <label className="form-label">
                <input
                  type="checkbox"
                  checked={shouldAdvanceStage}
                  disabled={!nextStage}
                  onChange={(e) => setShouldAdvanceStage(e.target.checked)}
                />{" "}
                Advance to next stage when saving
              </label>
            </div>
          )}

          {selectedBatch && assignmentMode === "whole" && (
            <div className="form-field">
              <label className="form-label">
                Destination Room:
                <select
                  className="form-select"
                  value={wholeRoomId}
                  onChange={(e) => setWholeRoomId(e.target.value)}
                  required
                >
                  <option value="">-- Select Room --</option>
                  {assignableRooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.locationId?.nickname || "Unknown Location"} -{" "}
                      {room.name} ({room.type})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {selectedBatch && assignmentMode === "split" && (
            <div className="form-field">
              <p className="status-message">
                Set plant counts per strain for each destination room. Totals
                must match the full batch.
              </p>

              {batchPlantTotals.map((plant) => (
                <p key={`totals-${plant.strainId}`} className="status-message">
                  {plant.strainName}: {getAllocatedCount(plant.strainId)} /{" "}
                  {plant.totalCount}
                </p>
              ))}

              {splitDestinations.map((destination, index) => (
                <div
                  key={`split-destination-${index}`}
                  className="form-field"
                  style={{ border: "1px solid #ddd", padding: "12px" }}
                >
                  <label className="form-label">
                    Destination Room {index + 1}
                    <select
                      className="form-select"
                      value={destination.roomId}
                      onChange={(e) =>
                        handleSplitRoomChange(index, e.target.value)
                      }
                    >
                      <option value="">-- Select Room --</option>
                      {assignableRooms.map((room) => (
                        <option key={room._id} value={room._id}>
                          {room.locationId?.nickname || "Unknown Location"} -{" "}
                          {room.name} ({room.type})
                        </option>
                      ))}
                    </select>
                  </label>

                  {batchPlantTotals.map((plant) => (
                    <label
                      className="form-label"
                      key={`split-${index}-${plant.strainId}`}
                    >
                      {plant.strainName} Count
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={
                          destination.strainCounts?.[plant.strainId] || "0"
                        }
                        onChange={(e) =>
                          handleSplitCountChange(
                            index,
                            plant.strainId,
                            e.target.value,
                          )
                        }
                      />
                    </label>
                  ))}

                  {splitDestinations.length > 1 && (
                    <button
                      className="submit-button"
                      type="button"
                      onClick={() => handleRemoveSplitDestination(index)}
                    >
                      Remove Room
                    </button>
                  )}
                </div>
              ))}

              <button
                className="submit-button"
                type="button"
                onClick={handleAddSplitDestination}
              >
                Add Destination Room
              </button>
            </div>
          )}

          <button className="submit-button" type="submit">
            Save Batch Room Plan
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
