// RoomForm — admin form to add/edit/remove rooms, or assign batch plants to one or more rooms.
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
import { getBatchStrainTotals, getRoomNamesForBatch } from "../../utils/batchHelpers";
import FormSubmitBar from "../ui/FormSubmitBar";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from "../../utils/api";

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

const TRANSPLANT_DESTINATION_ROOM_TYPES = new Set(["Veg", "Clone", "Flower"]);
const TRANSPLANT_SELECTABLE_STAGES = new Set(["Clone", "Veg"]);

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

// Main component: shows either the room CRUD form or the batch assignment form based on `section`.
function RoomForm({ section }) {  // Source datasets used for both room management and assignment flows.
  const [locations, setLocations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [roomAssignments, setRoomAssignments] = useState([]);

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

  // Clear all room form fields and the selected room id.
  const resetRoomForm = () => {    setFormData({ locationId: "", name: "", type: "", sqFoot: "" });
    setSelectedManageRoomId("");
  };

  // Tell other parts of the app that room data changed so they can refresh.
  const notifyRoomChange = (detail = null) => {    window.dispatchEvent(new CustomEvent("room:created", { detail }));
  };

  // Load location list from the API for the location dropdown.
  const fetchLocations = async () => {    try {
      const data = await apiGet("/api/locations");
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  // Load all rooms from the API for edit/remove and assignment dropdowns.
  const fetchRooms = async () => {    try {
      const data = await apiGet("/api/rooms");
      setRooms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  // Load all batches from the API for the assignment workflow.
  const fetchBatches = async () => {    try {
      const data = await apiGet("/api/batches");
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  const fetchRoomAssignments = async () => {
    try {
      const data = await apiGet("/api/room-assignments?active=true");
      setRoomAssignments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching room assignments:", error);
    }
  };

  useEffect(() => {
    // Load data on mount and listen for create/update events from other forms.
    fetchLocations();    fetchRooms();
    fetchBatches();
    fetchRoomAssignments();

    // Refresh all data when a new location is created elsewhere in the app.
    const handleLocationCreated = () => {      fetchLocations();
      fetchRooms();
      fetchBatches();
      fetchRoomAssignments();
    };

    // Refresh rooms and batches when a room or batch is created/updated elsewhere.
    const handleRoomOrBatchUpdated = () => {      fetchRooms();
      fetchBatches();
      fetchRoomAssignments();
    };

    window.addEventListener("location:created", handleLocationCreated);
    window.addEventListener("room:created", handleRoomOrBatchUpdated);
    window.addEventListener("batch:created", handleRoomOrBatchUpdated);
    window.addEventListener("batch:updated", handleRoomOrBatchUpdated);
    window.addEventListener("roomAssignment:created", handleRoomOrBatchUpdated);

    return () => {
      window.removeEventListener("location:created", handleLocationCreated);
      window.removeEventListener("room:created", handleRoomOrBatchUpdated);
      window.removeEventListener("batch:created", handleRoomOrBatchUpdated);
      window.removeEventListener("batch:updated", handleRoomOrBatchUpdated);
      window.removeEventListener("roomAssignment:created", handleRoomOrBatchUpdated);
    };
  }, []);

  const selectableBatches = useMemo(() => {
    const now = new Date();

    return [...batches]
      .filter((batch) => {
        if (batch?.batchType === "mom") return false;
        if (!TRANSPLANT_SELECTABLE_STAGES.has(batch?.lifecycleStage)) {
          return false;
        }

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

  const batchPlantTotals = useMemo(
    () => getBatchStrainTotals(selectedBatch),
    [selectedBatch],
  );

  const currentRoomNames = useMemo(
    () => getRoomNamesForBatch(selectedBatch?._id, roomAssignments),
    [selectedBatch, roomAssignments],
  );

  const assignableRooms = useMemo(() => {
    const transplantRooms = rooms.filter((room) =>
      TRANSPLANT_DESTINATION_ROOM_TYPES.has(room.type),
    );

    if (!selectedBatch?.location) return transplantRooms;

    return transplantRooms.filter(
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

  // Build a starting object with "0" for every strain count (used in split mode).
  const createZeroCounts = () =>    Object.fromEntries(batchPlantTotals.map((plant) => [plant.strainId, "0"]));

  // Reset all assignment fields when the user picks a different batch.
  const handleBatchSelection = (batchId) => {    setAssignmentData({ roomId: "", batchId });
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
    // When the selected batch changes, pre-fill whole-move counts with full availability.
    if (!selectedBatch) {      setWholeMoveCounts({});
      return;
    }

    setWholeMoveCounts(
      Object.fromEntries(
        batchPlantTotals.map((plant) => [
          plant.strainId,
          String(plant.count),
        ]),
      ),
    );
  }, [selectedBatch, batchPlantTotals]);

  // Update the plant count for one strain in whole-batch move mode.
  const handleWholeMoveCountChange = (strainId, value) => {    const normalizedValue =
      value === "" ? "" : String(Math.max(0, Number(value) || 0));

    setWholeMoveCounts((prev) => ({
      ...prev,
      [strainId]: normalizedValue,
    }));
  };

  // Add another destination room card in split assignment mode.
  const handleAddSplitDestination = () => {
    setSplitDestinations((prev) => [
      ...prev,
      {
        roomId: "",
        strainCounts: createZeroCounts(),
      },
    ]);
  };

  // Remove a split destination card by index.
  const handleRemoveSplitDestination = (index) => {
    setSplitDestinations((prev) => prev.filter((_, i) => i !== index));
  };

  // Change which room a split destination card points to.
  const handleSplitRoomChange = (index, roomId) => {
    setSplitDestinations((prev) =>
      prev.map((destination, i) =>
        i === index ? { ...destination, roomId } : destination,
      ),
    );
  };

  // Change the plant count for one strain inside one split destination card.
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

  // Add up how many plants of one strain are allocated across all split cards.
  const getAllocatedCount = (strainId) =>    splitDestinations.reduce(
      (sum, destination) =>
        sum + (Number(destination.strainCounts?.[strainId]) || 0),
      0,
    );

  // Switch between add, edit, and remove room modes and reset the form.
  const handleRoomModeChange = (nextMode) => {    setRoomMode(nextMode);
    setMessage("");
    resetRoomForm();
  };

  // Fill the form fields with the selected room's current values for editing.
  const handleManageRoomSelection = (roomId) => {    setSelectedManageRoomId(roomId);

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

  // Create a new room and save it to the API.
  const handleSubmit = async (e) => {
    e.preventDefault();    setMessage("");

    try {
      const savedRoom = await apiPost("/api/rooms", {
        locationId: formData.locationId,
        name: formData.name,
        type: formData.type,
        sqFoot: formData.sqFoot ? Number(formData.sqFoot) : null,
      });

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

  // Handle add, edit, or remove based on the current room mode.
  const handleManageRoomSubmit = async (e) => {
    e.preventDefault();    setMessage("");

    try {
      if (roomMode === "add") {
        return handleSubmit(e);
      }

      if (!selectedManageRoomId) {
        throw new Error("Please select a room");
      }

      if (roomMode === "edit") {
        // Edit mode updates an existing room by id.
        const updatedRoom = await apiPatch(`/api/rooms/${selectedManageRoomId}`, {
          locationId: formData.locationId,
          name: formData.name,
          type: formData.type,
          sqFoot: formData.sqFoot ? Number(formData.sqFoot) : null,
        });
        notifyRoomChange(updatedRoom);
        await fetchRooms();
        setMessage("Room updated successfully.");
        return;
      }

      if (roomMode === "remove") {
        // Remove mode deletes the selected room by id.
        await apiDelete(`/api/rooms/${selectedManageRoomId}`);

        notifyRoomChange({ _id: selectedManageRoomId });
        resetRoomForm();
        await fetchRooms();
        setMessage("Room removed successfully.");
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  // Save the batch room plan (whole move or split) to the API.
  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();    setAssignmentMessage("");

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
                max: plant.count,
              };
            })
            .filter((plant) => plant.count > 0);

          const hasExceeded = batchPlantTotals.some(
            (plant) =>
              (Number(wholeMoveCounts?.[plant.strainId]) || 0) >
              plant.count,
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
            ? totalsByStrain[plant.strainId] > plant.count
            : totalsByStrain[plant.strainId] !== plant.count,
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

      const result = await apiPost(
        `/api/batches/${assignmentData.batchId}/assign-rooms`,
        payload,
      );

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

  // --- Room CRUD form: add, edit, or remove a room ---
  const addRoomForm = (
    <Stack component="form" spacing={2} onSubmit={handleManageRoomSubmit}>
      {/* Mode picker: add a new room, edit one, or remove one. */}
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

      <FormSubmitBar color={roomMode === "remove" ? "error" : "primary"}>
        {roomMode === "add" && "Add Room"}
        {roomMode === "edit" && "Save Room Changes"}
        {roomMode === "remove" && "Remove Room"}
      </FormSubmitBar>

      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );

  // --- Batch assignment form: move plants to one or more rooms ---
  const assignRoomForm = (
    <Stack component="form" spacing={2} onSubmit={handleAssignmentSubmit}>
      {/* Batch picker — choosing a batch loads its stage info and assignment options. */}
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

      {/* Batch context card: current stage, time in stage, and existing room plan. */}
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
                Current Rooms:{" "}
                <strong>
                  {currentRoomNames.length > 0
                    ? currentRoomNames.join(", ")
                    : "No room assignments yet"}
                </strong>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Assignment options: whole vs split mode and optional stage/destroy toggles. */}
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
                        String(plant.count)
                      }
                      onChange={(e) =>
                        handleWholeMoveCountChange(
                          plant.strainId,
                          e.target.value,
                        )
                      }
                      helperText={`Available: ${plant.count}`}
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
                  {plant.count}
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

                      {splitDestinations.length > 1 ? (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleRemoveSplitDestination(index)}
                          sx={{ alignSelf: "flex-end", minWidth: 148 }}
                        >
                          Remove destination
                        </Button>
                      ) : null}
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

      <FormSubmitBar>Save Batch Room Plan</FormSubmitBar>

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

  // Show the assignment form or the room CRUD form depending on the section prop.
  if (section === "assign") return assignRoomForm;
  return addRoomForm;
}

export default RoomForm;
