import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { formatDate } from "../../utils/formatDate";

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

function RoomForm({ embedded, section }) {
  const [locations, setLocations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [batches, setBatches] = useState([]);

  const [formData, setFormData] = useState({
    locationId: "",
    name: "",
    type: "",
    sqFoot: "",
  });
  const [roomMode, setRoomMode] = useState("add");
  const [selectedManageRoomId, setSelectedManageRoomId] = useState("");

  const [assignmentData, setAssignmentData] = useState({
    roomId: "",
    batchId: "",
  });
  const [assignmentMode, setAssignmentMode] = useState("whole");
  const [wholeRoomId, setWholeRoomId] = useState("");
  const [wholeMoveCounts, setWholeMoveCounts] = useState({});
  const [splitDestinations, setSplitDestinations] = useState([]);
  const [shouldAdvanceStage, setShouldAdvanceStage] = useState(false);
  const [destroyUnallocatedPlants, setDestroyUnallocatedPlants] =
    useState(false);

  const [message, setMessage] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  const resetRoomForm = () => {
    setFormData({ locationId: "", name: "", type: "", sqFoot: "" });
    setSelectedManageRoomId("");
  };

  const notifyRoomChange = (detail = null) => {
    window.dispatchEvent(new CustomEvent("room:created", { detail }));
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

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

  const handleBatchSelection = (batchId) => {
    setAssignmentData({ roomId: "", batchId });
    setWholeRoomId("");
    setAssignmentMode("whole");
    setShouldAdvanceStage(false);
    setDestroyUnallocatedPlants(false);
    setWholeMoveCounts({});
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

  useEffect(() => {
    if (!selectedBatch) {
      setWholeMoveCounts({});
      return;
    }

    setWholeMoveCounts(
      Object.fromEntries(
        batchPlantTotals.map((plant) => [
          plant.strainId,
          String(plant.totalCount),
        ]),
      ),
    );
  }, [selectedBatch, batchPlantTotals]);

  const handleWholeMoveCountChange = (strainId, value) => {
    const normalizedValue =
      value === "" ? "" : String(Math.max(0, Number(value) || 0));

    setWholeMoveCounts((prev) => ({
      ...prev,
      [strainId]: normalizedValue,
    }));
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

  const handleRoomModeChange = (nextMode) => {
    setRoomMode(nextMode);
    setMessage("");
    resetRoomForm();
  };

  const handleManageRoomSelection = (roomId) => {
    setSelectedManageRoomId(roomId);

    const selectedRoom = rooms.find(
      (room) => String(room._id) === String(roomId),
    );

    setFormData({
      locationId: selectedRoom?.locationId?._id || "",
      name: selectedRoom?.name || "",
      type: selectedRoom?.type || "",
      sqFoot:
        selectedRoom?.sqFoot === null || selectedRoom?.sqFoot === undefined
          ? ""
          : String(selectedRoom.sqFoot),
    });
  };

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

  const handleManageRoomSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (roomMode === "add") {
        return handleSubmit(e);
      }

      if (!selectedManageRoomId) {
        throw new Error("Please select a room");
      }

      if (roomMode === "edit") {
        const res = await fetch(`/api/rooms/${selectedManageRoomId}`, {
          method: "PATCH",
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
          throw new Error(errorData.error || "Failed to update room");
        }

        const updatedRoom = await res.json();
        notifyRoomChange(updatedRoom);
        await fetchRooms();
        setMessage("Room updated successfully.");
        return;
      }

      if (roomMode === "remove") {
        const res = await fetch(`/api/rooms/${selectedManageRoomId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to remove room");
        }

        notifyRoomChange({ _id: selectedManageRoomId });
        resetRoomForm();
        await fetchRooms();
        setMessage("Room removed successfully.");
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    setAssignmentMessage("");

    try {
      if (!assignmentData.batchId) {
        throw new Error("Please select a batch");
      }

      const payload = {
        mode: assignmentMode,
        notes: null,
        advanceStage: shouldAdvanceStage,
        destroyUnallocated: destroyUnallocatedPlants,
      };

      if (assignmentMode === "whole") {
        if (!wholeRoomId) {
          throw new Error("Please select a destination room");
        }
        payload.roomId = wholeRoomId;

        if (destroyUnallocatedPlants) {
          const plannedPlants = batchPlantTotals
            .map((plant) => {
              const planned = Number(wholeMoveCounts?.[plant.strainId]) || 0;
              return {
                strainId: plant.strainId,
                count: planned,
                max: plant.totalCount,
              };
            })
            .filter((plant) => plant.count > 0);

          const hasExceeded = batchPlantTotals.some(
            (plant) =>
              (Number(wholeMoveCounts?.[plant.strainId]) || 0) >
              plant.totalCount,
          );

          if (hasExceeded) {
            throw new Error(
              "Move counts cannot exceed available plants by strain",
            );
          }

          if (plannedPlants.length === 0) {
            throw new Error("Set at least one plant count to move");
          }

          payload.plants = plannedPlants.map((plant) => ({
            strainId: plant.strainId,
            count: plant.count,
          }));
        }
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

        const hasMismatch = batchPlantTotals.some((plant) =>
          destroyUnallocatedPlants
            ? totalsByStrain[plant.strainId] > plant.totalCount
            : totalsByStrain[plant.strainId] !== plant.totalCount,
        );

        if (hasMismatch) {
          throw new Error(
            destroyUnallocatedPlants
              ? "Split counts cannot exceed the available total for any strain"
              : "Split counts must exactly match the full batch totals for each strain",
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
      setWholeMoveCounts({});
      setSplitDestinations([]);
      setShouldAdvanceStage(false);
      setDestroyUnallocatedPlants(false);
      fetchBatches();
    } catch (error) {
      setAssignmentMessage(`Error: ${error.message}`);
    }
  };

  const addRoomForm = (
    <Stack component="form" spacing={2} onSubmit={handleManageRoomSubmit}>
      <TextField
        select
        label="Mode"
        value={roomMode}
        onChange={(e) => handleRoomModeChange(e.target.value)}
      >
        <MenuItem value="add">Add Room</MenuItem>
        <MenuItem value="edit">Edit Room</MenuItem>
        <MenuItem value="remove">Remove Room</MenuItem>
      </TextField>

      {roomMode !== "add" && (
        <TextField
          select
          label="Room"
          value={selectedManageRoomId}
          onChange={(e) => handleManageRoomSelection(e.target.value)}
          required
        >
          <MenuItem value="">Select Room</MenuItem>
          {rooms
            .slice()
            .sort((a, b) => (a?.name || "").localeCompare(b?.name || ""))
            .map((room) => (
              <MenuItem key={room._id} value={room._id}>
                {room.locationId?.nickname || "Unknown Location"} - {room.name}
                {room.type ? ` (${room.type})` : ""}
              </MenuItem>
            ))}
        </TextField>
      )}

      <Divider />

      {roomMode !== "remove" && (
        <>
          <TextField
            select
            label="Location"
            value={formData.locationId}
            onChange={(e) =>
              setFormData({ ...formData, locationId: e.target.value })
            }
            required
          >
            <MenuItem value="">Select Location</MenuItem>
            {locations.map((loc) => (
              <MenuItem key={loc._id} value={loc._id}>
                {loc.nickname}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Room Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <TextField
            select
            label="Room Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            required
          >
            <MenuItem value="">Select Room Type</MenuItem>
            {ROOM_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Square Feet"
            type="number"
            value={formData.sqFoot}
            onChange={(e) =>
              setFormData({ ...formData, sqFoot: e.target.value })
            }
          />
        </>
      )}

      {roomMode === "remove" && (
        <Alert severity="warning">
          This will permanently remove the selected room if it is not referenced
          by existing records.
        </Alert>
      )}

      <Button
        variant="contained"
        color={roomMode === "remove" ? "error" : "primary"}
        type="submit"
      >
        {roomMode === "add" && "Add Room"}
        {roomMode === "edit" && "Save Room Changes"}
        {roomMode === "remove" && "Remove Room"}
      </Button>

      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );

  const assignRoomForm = (
    <Stack component="form" spacing={2} onSubmit={handleAssignmentSubmit}>
      <TextField
        select
        label="Batch"
        value={assignmentData.batchId}
        onChange={(e) => handleBatchSelection(e.target.value)}
        required
      >
        <MenuItem value="">Select Batch</MenuItem>
        {selectableBatches.map((batch) => (
          <MenuItem key={batch._id} value={batch._id}>
            {batch.batchNumber} | Clone: {formatDate(batch.cloneDate)} |
            Harvest: {formatDate(batch.harvestDate)}
          </MenuItem>
        ))}
      </TextField>

      {selectedBatch && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Current Stage: <strong>{selectedBatch.lifecycleStage}</strong>
              </Typography>
              <Typography variant="body2">
                In Stage For: <strong>{daysInStage}</strong>
              </Typography>
              <Typography variant="body2">
                Next Stage: <strong>{nextStage || "N/A"}</strong>
              </Typography>
              <Typography variant="body2">
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
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {selectedBatch && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.25}>
              <RadioGroup
                value={assignmentMode}
                onChange={(e) => setAssignmentMode(e.target.value)}
              >
                <FormControlLabel
                  value="whole"
                  control={<Radio />}
                  label="Whole batch to one room"
                />
                <FormControlLabel
                  value="split"
                  control={<Radio />}
                  label="Split strains/plants across multiple rooms"
                />
              </RadioGroup>

              <FormControlLabel
                control={
                  <Switch
                    checked={shouldAdvanceStage}
                    disabled={!nextStage}
                    onChange={(e) => setShouldAdvanceStage(e.target.checked)}
                  />
                }
                label="Advance to next stage when saving"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={destroyUnallocatedPlants}
                    onChange={(e) =>
                      setDestroyUnallocatedPlants(e.target.checked)
                    }
                  />
                }
                label="Destroy plants that are not allocated in this move"
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {selectedBatch && assignmentMode === "whole" && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <TextField
                select
                label="Destination Room"
                value={wholeRoomId}
                onChange={(e) => setWholeRoomId(e.target.value)}
                required
              >
                <MenuItem value="">Select Room</MenuItem>
                {assignableRooms.map((room) => (
                  <MenuItem key={room._id} value={room._id}>
                    {room.locationId?.nickname || "Unknown Location"} -{" "}
                    {room.name} ({room.type})
                  </MenuItem>
                ))}
              </TextField>

              {destroyUnallocatedPlants && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Enter how many plants to move per strain. Any remainder will
                    be destroyed.
                  </Typography>
                  {batchPlantTotals.map((plant) => (
                    <TextField
                      key={`whole-${plant.strainId}`}
                      type="number"
                      label={`${plant.strainName} To Move`}
                      value={
                        wholeMoveCounts?.[plant.strainId] ??
                        String(plant.totalCount)
                      }
                      onChange={(e) =>
                        handleWholeMoveCountChange(
                          plant.strainId,
                          e.target.value,
                        )
                      }
                      helperText={`Available: ${plant.totalCount}`}
                    />
                  ))}
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {selectedBatch && assignmentMode === "split" && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Set plant counts per strain for each destination room.
                {destroyUnallocatedPlants
                  ? " Any unallocated remainder is destroyed."
                  : " Totals must match the full batch."}
              </Typography>

              {batchPlantTotals.map((plant) => (
                <Typography key={`totals-${plant.strainId}`} variant="body2">
                  {plant.strainName}: {getAllocatedCount(plant.strainId)} /{" "}
                  {plant.totalCount}
                </Typography>
              ))}

              {splitDestinations.map((destination, index) => (
                <Card key={`split-${index}`} variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <TextField
                        select
                        label={`Destination Room ${index + 1}`}
                        value={destination.roomId}
                        onChange={(e) =>
                          handleSplitRoomChange(index, e.target.value)
                        }
                      >
                        <MenuItem value="">Select Room</MenuItem>
                        {assignableRooms.map((room) => (
                          <MenuItem key={room._id} value={room._id}>
                            {room.locationId?.nickname || "Unknown Location"} -{" "}
                            {room.name} ({room.type})
                          </MenuItem>
                        ))}
                      </TextField>

                      {batchPlantTotals.map((plant) => (
                        <TextField
                          key={`split-${index}-${plant.strainId}`}
                          type="number"
                          label={`${plant.strainName} Count`}
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
                      ))}

                      {splitDestinations.length > 1 && (
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => handleRemoveSplitDestination(index)}
                        >
                          Remove Room
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outlined" onClick={handleAddSplitDestination}>
                Add Destination Room
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Button variant="contained" type="submit">
        Save Batch Room Plan
      </Button>

      {assignmentMessage && (
        <Alert
          severity={
            assignmentMessage.startsWith("Error:") ? "error" : "success"
          }
        >
          {assignmentMessage}
        </Alert>
      )}
    </Stack>
  );

  if (embedded && section === "add") return addRoomForm;
  if (embedded && section === "assign") return assignRoomForm;

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6">Room Management</Typography>
        {addRoomForm}
      </Stack>

      <Divider />

      <Stack spacing={1}>
        <Typography variant="h6">Assign Batch To Room</Typography>
        {assignRoomForm}
      </Stack>
    </Stack>
  );
}

export default RoomForm;
