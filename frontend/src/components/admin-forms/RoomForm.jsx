import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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

// Combined room management form and plant assignment workflow.
function RoomForm({ section }) {
  // Source datasets used for both room management and assignment flows.
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
  // whole mode uses one room; split mode uses multiple destination cards.
  const [wholeRoomId, setWholeRoomId] = useState("");
  const [wholeMoveCounts, setWholeMoveCounts] = useState({});
  const [splitDestinations, setSplitDestinations] = useState([]);
  const [shouldAdvanceStage, setShouldAdvanceStage] = useState(false);
  const [destroyUnallocatedPlants, setDestroyUnallocatedPlants] =
    useState(false);

  const [message, setMessage] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");

  const resetRoomForm = () => {
    // Clear editable room fields and selected room id.
    setFormData({ locationId: "", name: "", type: "", sqFoot: "" });
    setSelectedManageRoomId("");
  };

  // Notify listeners that room-related data changed.
  const notifyRoomChange = (detail = null) => {
    window.dispatchEvent(new CustomEvent("room:created", { detail }));
  };

  const fetchLocations = async () => {
    // Load available locations for room creation/editing dropdown.
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const fetchRooms = async () => {
    // Load all rooms for edit/remove selection and assignment views.
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchBatches = async () => {
    // Load batches for assignment workflow.
    try {
      const res = await fetch("/api/batches");
      const data = await res.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  useEffect(() => {
    // Load base data and register listeners so this form stays synchronized.
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

  // Only show batches that are still active/upcoming by harvest date.
  const selectableBatches = useMemo(() => {
    // This keeps assignment dropdown focused on batches that still need action.
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
    // Resolve selected batch id into full batch object for downstream calculations.
    () =>
      selectableBatches.find(
        (batch) => String(batch._id) === String(assignmentData.batchId),
      ) || null,
    [selectableBatches, assignmentData.batchId],
  );

  const batchPlantTotals = useMemo(() => {
    // Convert nested room plant rows into one total per strain for validation.
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
    // If batch has a location, only allow rooms from that same location.
    if (!selectedBatch?.location) return rooms;

    return rooms.filter(
      (room) =>
        String(room?.locationId?._id) === String(selectedBatch.location),
    );
  }, [rooms, selectedBatch]);

  const nextStage = useMemo(() => {
    // Determine stage transition suggestion from current batch type + stage.
    if (!selectedBatch) return null;
    const map =
      NEXT_STAGE_BY_BATCH_TYPE[selectedBatch.batchType] ||
      NEXT_STAGE_BY_BATCH_TYPE.production;
    return map[selectedBatch.lifecycleStage] || null;
  }, [selectedBatch]);

  const daysInStage = useMemo(() => {
    // Convert stageStartedAt timestamp into human-readable day count.
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
    // Build an object like {strainId: "0"} for initializing split forms.
    Object.fromEntries(batchPlantTotals.map((plant) => [plant.strainId, "0"]));

  // Reset assignment controls when switching to a different batch.
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
    // When selected batch changes, prefill whole-move counts with full availability.
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
    // Sanitize whole-move strain count input to non-negative values.
    const normalizedValue =
      value === "" ? "" : String(Math.max(0, Number(value) || 0));

    setWholeMoveCounts((prev) => ({
      ...prev,
      [strainId]: normalizedValue,
    }));
  };

  const handleAddSplitDestination = () => {
    // Add one more destination room card in split mode.
    setSplitDestinations((prev) => [
      ...prev,
      {
        roomId: "",
        strainCounts: createZeroCounts(),
      },
    ]);
  };

  const handleRemoveSplitDestination = (index) => {
    // Remove a destination card by index in split mode.
    setSplitDestinations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSplitRoomChange = (index, roomId) => {
    // Update which room this split card is targeting.
    setSplitDestinations((prev) =>
      prev.map((destination, i) =>
        i === index ? { ...destination, roomId } : destination,
      ),
    );
  };

  const handleSplitCountChange = (index, strainId, value) => {
    // Update one strain count inside one split destination card.
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
    // Sum allocated plants for this strain across all split destination cards.
    splitDestinations.reduce(
      (sum, destination) =>
        sum + (Number(destination.strainCounts?.[strainId]) || 0),
      0,
    );

  const handleRoomModeChange = (nextMode) => {
    // Switch add/edit/remove mode and reset stale form state.
    setRoomMode(nextMode);
    setMessage("");
    resetRoomForm();
  };

  const handleManageRoomSelection = (roomId) => {
    // Load selected room values into controlled form fields for editing.
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
    // Add a brand-new room.
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
    // Branch to add/edit/remove behavior based on roomMode.
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
        // Edit mode updates an existing room by id.
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
        // Remove mode deletes the selected room by id.
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
    // Save whole/split room allocation plan for selected batch.
    e.preventDefault();
    setAssignmentMessage("");

    try {
      if (!assignmentData.batchId) {
        throw new Error("Please select a batch");
      }

      const payload = {
        // Shared flags interpreted by backend assignment endpoint.
        mode: assignmentMode,
        notes: null,
        advanceStage: shouldAdvanceStage,
        destroyUnallocated: destroyUnallocatedPlants,
      };

      if (assignmentMode === "whole") {
        // Whole mode sends one destination room with optional strain counts.
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
        // Normalize split destination cards into API-friendly assignment objects.
        const normalizedAssignments = splitDestinations
          // First keep only destination cards with a selected room.
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
          // Start per-strain totals at zero before summing split destinations.
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

      // Notify app shell and other panels to refresh related data.
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
    // Room CRUD form (add/edit/remove) rendered from one mode-driven UI.
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
        // In edit/remove modes, user must pick the target room first.
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
          {/* Standard room fields shown for add/edit modes only. */}
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
        // Explicit warning for destructive room deletion.
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
    // Batch-to-room assignment form (whole move or split allocation).
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
          // Each batch option includes clone/harvest dates and current stage chip.
          <MenuItem key={batch._id} value={batch._id}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              sx={{ width: "100%" }}
            >
              <Typography variant="body2">
                {batch.batchNumber} | Clone: {formatDate(batch.cloneDate)} |
                Harvest: {formatDate(batch.harvestDate)}
              </Typography>
              <Chip
                size="small"
                label={batch.lifecycleStage || "N/A"}
                color="primary"
                variant="outlined"
              />
            </Stack>
          </MenuItem>
        ))}
      </TextField>

      {selectedBatch && (
        // Context card shows current stage timing and existing plan.
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
              {/* RadioGroup is a simple mode switch for assignment strategy. */}
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
                // Optional stage transition is controlled by the backend during save.
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
        // Whole mode UI: pick one destination and optionally partial move counts.
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
        // Split mode UI: allocate each strain across one or more destination rooms.
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              {/* One nested card per destination room in split mode. */}
              <Typography variant="body2" color="text.secondary">
                Set plant counts per strain for each destination room.
                {destroyUnallocatedPlants
                  ? " Any unallocated remainder is destroyed."
                  : " Totals must match the full batch."}
              </Typography>

              {batchPlantTotals.map((plant) => (
                // Live running total for each strain across all split destination cards.
                <Typography key={`totals-${plant.strainId}`} variant="body2">
                  {plant.strainName}: {getAllocatedCount(plant.strainId)} /{" "}
                  {plant.totalCount}
                </Typography>
              ))}

              {splitDestinations.map((destination, index) => (
                // One nested card represents one destination room allocation bucket.
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

  if (section === "assign") return assignRoomForm;

  return addRoomForm;
}

export default RoomForm;
