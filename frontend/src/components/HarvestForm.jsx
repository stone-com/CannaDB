import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiGet, apiPost } from "../utils/api";
import ListRow from "./ui/ListRow";
import RemoveButton from "./ui/RemoveButton";

const SELECT_MENU_PROPS = {
  disablePortal: true,
};

// This form records wet harvest weights (totes) for each strain in a batch and room.
// Users pick a batch, choose a room, enter tote weights, then submit the harvest.
function HarvestForm({ onComplete }) {
  // Data used by dropdowns and lookups.
  const [batches, setBatches] = useState([]);
  const [roomAssignments, setRoomAssignments] = useState([]);

  // Current user selections.
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedStrainId, setSelectedStrainId] = useState(null);

  // Tote weights keyed by strain ID.
  const [totes, setTotes] = useState({});
  const [weightInput, setWeightInput] = useState("");

  // Load batches and room assignments when the form first opens.
  useEffect(() => {
    // Loads batch and assignment data from the server in parallel.
    const loadData = async () => {
      try {
        const [batchData, assignmentData] = await Promise.all([
          apiGet("/api/batches"),
          apiGet("/api/room-assignments?active=true"),
        ]);
        setBatches(Array.isArray(batchData) ? batchData : []);
        setRoomAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      } catch (error) {
        console.error("Error fetching harvest form data:", error);
      }
    };

    loadData();
  }, []);

  // Only allow batches that are ready to harvest and not already harvested.
  const unharvestedBatches = useMemo(
    // Restrict dropdown to batches that still need wet harvest intake.
    () =>
      batches.filter(
        (batch) =>
          !batch.harvestId &&
          String(batch.lifecycleStage || "").toLowerCase() === "harvestready",
      ),
    [batches],
  );

  const selectedBatch = useMemo(
    // Find full batch object for the currently selected batch id.
    () => batches.find((batch) => batch._id === selectedBatchId) || null,
    [batches, selectedBatchId],
  );

  const availableRooms = useMemo(() => {
    // Build unique room list for this batch from active room assignments.
    if (!selectedBatchId) return [];

    const assignedRoomMap = new Map();

    roomAssignments
      .filter(
        (assignment) =>
          String(assignment?.batchId?._id) === String(selectedBatchId) &&
          assignment?.active !== false,
      )
      .forEach((assignment) => {
        const room = assignment?.roomId;
        if (room?._id) {
          assignedRoomMap.set(String(room._id), room);
        }
      });

    return Array.from(assignedRoomMap.values());
  }, [roomAssignments, selectedBatchId]);

  const selectedRoomAssignment = useMemo(
    // Find the active assignment row that matches both selected batch and room.
    () =>
      roomAssignments.find(
        (assignment) =>
          String(assignment?.batchId?._id) === String(selectedBatchId) &&
          String(assignment?.roomId?._id) === String(selectedRoomId) &&
          assignment?.active !== false,
      ) || null,
    [roomAssignments, selectedBatchId, selectedRoomId],
  );

  const activePlants = useMemo(
    // Normalize assignedPlants so render logic can always treat it as an array.
    () =>
      Array.isArray(selectedRoomAssignment?.assignedPlants)
        ? selectedRoomAssignment.assignedPlants
        : [],
    [selectedRoomAssignment],
  );

  const selectedStrainPlant = useMemo(
    // Identify the selected strain row so the tote editor can show context.
    () =>
      activePlants.find((plant) => plant.strainId?._id === selectedStrainId) ||
      null,
    [activePlants, selectedStrainId],
  );

  const totalPlants = useMemo(
    // Sum all plant counts in this room for quick context on harvest scope.
    () => activePlants.reduce((sum, plant) => sum + (plant.count || 0), 0),
    [activePlants],
  );

  const activeTotes = useMemo(
    // Read only the tote list for whichever strain is currently selected.
    () => (selectedStrainId ? totes[selectedStrainId] || [] : []),
    [selectedStrainId, totes],
  );

  const activeToteTotal = useMemo(
    // Compute total wet grams for this strain from its tote entries.
    () => activeTotes.reduce((sum, weight) => sum + weight, 0),
    [activeTotes],
  );

  // Clears room, strain, and tote selections when the user picks a different batch.
  const handleBatchChange = (e) => {
    setSelectedBatchId(e.target.value);
    setSelectedRoomId("");
    setSelectedStrainId(null);
    setTotes({});
    setWeightInput("");
  };

  // Switches to a strain so the user can enter tote weights for it.
  const handleStrainClick = (strainId) => {
    setSelectedStrainId(strainId);
    setWeightInput("");
  };

  // Adds one tote weight to the list for the currently selected strain.
  const handleAddTote = () => {
    const weight = parseFloat(weightInput);
    if (Number.isNaN(weight) || weight <= 0) return;

    setTotes((prev) => ({
      ...prev,
      [selectedStrainId]: [...(prev[selectedStrainId] || []), weight],
    }));
    setWeightInput("");
  };

  // Removes one tote entry from a strain's weight list.
  const handleRemoveTote = (strainId, index) => {
    setTotes((prev) => ({
      ...prev,
      [strainId]: prev[strainId].filter((_, i) => i !== index),
    }));
  };

  // Sends the harvest data to the server and resets the form on success.
  const handleSubmit = async () => {
    if (!selectedBatchId || !selectedRoomId) {
      window.alert("Please select a batch and a room.");
      return;
    }

    try {
      const strainsPayload = activePlants.map((plant) => ({
        // Each strain carries tote-level wet weights for backend calculations.
        strainId: plant.strainId?._id,
        plantCount: plant.count,
        totes: (totes[plant.strainId?._id] || []).map((weight) => ({
          wetWeight: weight,
        })),
      }));

      const room = availableRooms.find((r) => r._id === selectedRoomId);
      const locationId = room?.locationId?._id;

      if (!locationId) {
        window.alert("Could not find location for selected room.");
        return;
      }

      const payload = {
        batchId: selectedBatchId,
        locationId,
        harvestNumber: `${selectedBatch?.batchNumber}-${Date.now()}`,
        harvestDate: selectedBatch?.harvestDate || new Date().toISOString(),
        rooms: [{ roomId: selectedRoomId, strains: strainsPayload }],
      };

      await apiPost("/api/harvests", payload);

      setSelectedBatchId("");
      setSelectedRoomId("");
      setSelectedStrainId(null);
      setTotes({});
      setWeightInput("");

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      window.alert(`Error: ${error.message}`);
    }
  };

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      sx={{ height: "100%" }}
    >
      {/* Left side: batch and room pickers, strain list, submit button */}
      <Stack spacing={2} sx={{ width: { xs: "100%", md: 360 } }}>
        {/* Page title */}
        <Typography variant="h6">Harvest Intake Form</Typography>

        {/* Batch dropdown (HarvestReady batches only) */}
        <TextField
          select
          label="Batch (HarvestReady Only)"
          value={selectedBatchId}
          onChange={handleBatchChange}
          // disablePortal keeps the menu anchored inside draggable window layers.
          SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
        >
          <MenuItem value="">Select Batch</MenuItem>
          {unharvestedBatches.map((batch) => {
            const dateStr = batch.harvestDate
              ? new Date(batch.harvestDate).toLocaleDateString()
              : "No date set";
            return (
              <MenuItem key={batch._id} value={batch._id}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ width: "100%" }}
                >
                  <Typography variant="body2">
                    {batch.batchNumber} - {dateStr}
                  </Typography>
                  <Chip
                    size="small"
                    color="success"
                    label={batch.lifecycleStage || "N/A"}
                    variant="outlined"
                  />
                </Stack>
              </MenuItem>
            );
          })}
        </TextField>

        <Typography variant="caption" color="text.secondary">
          Only batches in HarvestReady stage can be selected for intake.
        </Typography>

        {/* Room dropdown for the selected batch */}
        <TextField
          select
          label="Harvest Room"
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
        >
          <MenuItem value="">Select Room</MenuItem>
          {availableRooms.map((room) => (
            // Room options come from active room assignments for selected batch.
            <MenuItem key={room._id} value={room._id}>
              {room.name}
            </MenuItem>
          ))}
        </TextField>

        {/* Strain list for the selected batch */}
        {selectedBatch && (
          <Card variant="outlined">
            <CardContent>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {selectedBatch.batchNumber} Strains
              </Typography>
              <Stack spacing={1}>
                {activePlants.map((plant) => {
                  // Render one selectable button per strain currently in this room.
                  const strainId = plant.strainId?._id;
                  const strainName = plant.strainId?.name || "Unknown";
                  const toteCount = (totes[strainId] || []).length;
                  const isActive = selectedStrainId === strainId;

                  return (
                    <Button
                      key={strainId}
                      variant={isActive ? "contained" : "outlined"}
                      color={isActive ? "primary" : "inherit"}
                      onClick={() => handleStrainClick(strainId)}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <span>
                        {strainName} - {plant.count} Plants
                      </span>
                      {toteCount > 0 && (
                        <Chip
                          size="small"
                          color="secondary"
                          label={`${toteCount} tote${toteCount !== 1 ? "s" : ""}`}
                        />
                      )}
                    </Button>
                  );
                })}
              </Stack>
              <Typography sx={{ mt: 1.5 }} variant="body2">
                Total Plants to Harvest: <strong>{totalPlants}</strong>
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Submit harvest button */}
        {selectedBatchId && selectedRoomId && (
          <Button variant="contained" size="large" onClick={handleSubmit}>
            Submit Harvest
          </Button>
        )}
      </Stack>

      {/* Right side: tote weight editor for the selected strain */}
      <Box sx={{ flex: 1 }}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardContent>
            {selectedStrainPlant ? (
              // Context-sensitive editor: shown only after user clicks a strain.
              <Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {selectedStrainPlant.strainId?.name} -{" "}
                  {selectedStrainPlant.count} Plants
                </Typography>

                <Stack direction="row" spacing={1}>
                  <TextField
                    type="number"
                    label="Wet Weight (grams)"
                    fullWidth
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTote();
                    }}
                    placeholder="e.g. 2660"
                  />
                  <Button variant="contained" onClick={handleAddTote}>
                    Add
                  </Button>
                </Stack>

                <Divider />

                {activeTotes.length > 0 ? (
                  <Stack spacing={1}>
                    {activeTotes.map((weight, i) => (
                      <ListRow
                        key={i}
                        label={
                          <Typography variant="body2">
                            Tote {i + 1}:{" "}
                            <strong>{weight.toLocaleString()} g</strong>
                          </Typography>
                        }
                      >
                        <RemoveButton
                          label="Remove tote"
                          onClick={() =>
                            handleRemoveTote(selectedStrainId, i)
                          }
                        />
                      </ListRow>
                    ))}
                    <Typography variant="body1" sx={{ pt: 0.5 }}>
                      Total:{" "}
                      <strong>{activeToteTotal.toLocaleString()} g</strong>
                    </Typography>
                  </Stack>
                ) : (
                  <Alert severity="info">No tote weights recorded yet.</Alert>
                )}
              </Stack>
            ) : (
              <Alert severity="info">
                {selectedBatch
                  ? "Click a strain on the left to enter tote weights."
                  : "Select a batch to get started."}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

export default HarvestForm;
