import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiGet, apiPost } from "../../utils/api";

// This form converts plants from a Veg production batch into a new mom batch.
// Users pick a source batch, choose a mom room, set counts per strain, then submit.
function CreateMomsForm() {
  // Data sources and controlled fields for the conversion workflow.
  const [batches, setBatches] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedMomRoomId, setSelectedMomRoomId] = useState("");
  const [momCuts, setMomCuts] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Loads batches and rooms from the server for the dropdowns.
  const fetchData = async () => {
    try {
      const [batchData, roomData] = await Promise.all([
        apiGet("/api/batches"),
        apiGet("/api/rooms"),
      ]);

      setBatches(Array.isArray(batchData) ? batchData : []);
      setRooms(Array.isArray(roomData) ? roomData : []);
    } catch (error) {
      console.error("Error loading create-moms form data:", error);
      setMessage("Error loading data.");
    }
  };

  useEffect(() => {
    // Load initial dropdown data when the form first appears.
    fetchData();
  }, []);

  const vegProductionBatches = useMemo(
    // Only production batches in Veg stage can be converted to moms.
    () =>
      batches
        .filter(
          (batch) =>
            batch.batchType === "production" &&
            String(batch.lifecycleStage || "").toLowerCase() === "veg",
        )
        .sort((a, b) =>
          (a.batchNumber || "").localeCompare(b.batchNumber || ""),
        ),
    [batches],
  );

  const selectedBatch = useMemo(
    // Resolve selected source batch id into the full batch object.
    () =>
      vegProductionBatches.find(
        (batch) => String(batch._id) === String(selectedBatchId),
      ) || null,
    [vegProductionBatches, selectedBatchId],
  );

  const availablePlantsByStrain = useMemo(() => {
    // Convert nested room plant rows into one total per strain for this batch.
    if (!selectedBatch) return [];

    const totals = new Map();

    (selectedBatch.rooms || []).forEach((roomEntry) => {
      (roomEntry?.plants || []).forEach((plantEntry) => {
        const strainId = String(
          plantEntry?.strainId?._id || plantEntry?.strainId || "",
        );
        if (!strainId) return;

        const current = totals.get(strainId) || {
          strainId,
          strainName: plantEntry?.strainId?.name || "Unknown Strain",
          totalCount: 0,
        };

        current.totalCount += Number(plantEntry?.count) || 0;
        totals.set(strainId, current);
      });
    });

    return Array.from(totals.values());
  }, [selectedBatch]);

  const momRoomsAtLocation = useMemo(() => {
    // Limit destination options to Mom rooms at the same location as source batch.
    if (!selectedBatch?.location) return [];

    return rooms.filter(
      (room) =>
        room.type === "Mom" &&
        String(room?.locationId?._id) === String(selectedBatch.location),
    );
  }, [rooms, selectedBatch]);

  // Reset dependent selections and initialize cut counts for this source batch.
  const handleBatchChange = (batchId) => {
    setSelectedBatchId(batchId);
    setMessage("");

    const chosenBatch = vegProductionBatches.find(
      (batch) => String(batch._id) === String(batchId),
    );

    const defaultMomRoom = rooms.find(
      (room) =>
        room.type === "Mom" &&
        String(room?.locationId?._id) === String(chosenBatch?.location),
    );

    setSelectedMomRoomId(defaultMomRoom?._id || "");

    const initialCuts = {};
    (chosenBatch?.rooms || []).forEach((roomEntry) => {
      (roomEntry?.plants || []).forEach((plantEntry) => {
        const strainId = String(
          plantEntry?.strainId?._id || plantEntry?.strainId,
        );
        if (strainId && !(strainId in initialCuts)) {
          initialCuts[strainId] = "0";
        }
      });
    });
    setMomCuts(initialCuts);
  };

  const handleCutChange = (strainId, value) => {
    // Keep strain cut counts non-negative and string-backed for text input control.
    const normalized =
      value === "" ? "" : String(Math.max(0, Number(value) || 0));
    setMomCuts((prev) => ({ ...prev, [strainId]: normalized }));
  };

  const totalMomPlants = availablePlantsByStrain.reduce(
    // Live total helps operators verify how many plants are being converted.
    (sum, strain) => sum + (Number(momCuts[strain.strainId]) || 0),
    0,
  );

  // Submit conversion request and emit events for app-wide refresh.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!selectedBatch) {
      setMessage("Please select a source production batch in Veg stage.");
      return;
    }

    if (!selectedMomRoomId) {
      setMessage("Please select a mom room.");
      return;
    }

    const plantsPayload = availablePlantsByStrain
      .map((strain) => ({
        strainId: strain.strainId,
        count: Number(momCuts[strain.strainId]) || 0,
      }))
      .filter((entry) => entry.count > 0);

    if (plantsPayload.length === 0) {
      setMessage("Select at least one strain count to convert into moms.");
      return;
    }

    const overdrawn = plantsPayload.find((entry) => {
      const source = availablePlantsByStrain.find(
        (strain) => strain.strainId === entry.strainId,
      );
      return entry.count > (source?.totalCount || 0);
    });

    if (overdrawn) {
      setMessage("One or more selected counts exceed available plants.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await apiPost(
        `/api/batches/${selectedBatch._id}/create-moms`,
        {
          momRoomId: selectedMomRoomId,
          plants: plantsPayload,
        },
      );

      window.dispatchEvent(
        new CustomEvent("batch:updated", { detail: result.sourceBatch }),
      );
      window.dispatchEvent(
        new CustomEvent("batch:created", { detail: result.momBatch }),
      );
      window.dispatchEvent(
        new CustomEvent("roomAssignment:created", {
          detail: result.momAssignment,
        }),
      );

      setMessage(
        `Mom batch ${result.momBatch?.batchNumber || "created"} successfully.`,
      );
      setSelectedBatchId("");
      setSelectedMomRoomId("");
      setMomCuts({});
      await fetchData();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const body = (
    <>
      {/* Single form handles source batch selection, room selection, and strain counts. */}
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        {/* Source batch picker (Veg production batches only) */}
        <TextField
          select
          label="Source Production Batch (Veg Only)"
          value={selectedBatchId}
          onChange={(e) => handleBatchChange(e.target.value)}
        >
          <MenuItem value="">Select Batch</MenuItem>
          {vegProductionBatches.map((batch) => (
            // Each dropdown item shows a batch and its current lifecycle stage.
            <MenuItem key={batch._id} value={batch._id}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{ width: "100%" }}
              >
                <Typography variant="body2">{batch.batchNumber}</Typography>
                <Chip
                  size="small"
                  label={batch.lifecycleStage || "N/A"}
                  color="success"
                  variant="outlined"
                />
              </Stack>
            </MenuItem>
          ))}
        </TextField>

        {selectedBatch && (
          <>
            {/* Destination mom room picker */}
            <TextField
              select
              label="Mom Room"
              value={selectedMomRoomId}
              onChange={(e) => setSelectedMomRoomId(e.target.value)}
            >
              <MenuItem value="">Select Mom Room</MenuItem>
              {momRoomsAtLocation.map((room) => (
                <MenuItem key={room._id} value={room._id}>
                  {room.locationId?.nickname || "Unknown Location"} -{" "}
                  {room.name}
                </MenuItem>
              ))}
            </TextField>

            {/* Instructions for strain cut counts */}
            <Typography variant="body2" color="text.secondary">
              Select how many plants from each strain to convert to moms.
            </Typography>

            {/* One count input per strain */}
            {availablePlantsByStrain.map((strain) => (
              <TextField
                key={strain.strainId}
                type="number"
                label={`${strain.strainName} (available: ${strain.totalCount})`}
                inputProps={{ min: 0, max: strain.totalCount }}
                value={momCuts[strain.strainId] || "0"}
                onChange={(e) =>
                  handleCutChange(strain.strainId, e.target.value)
                }
              />
            ))}

            <Typography variant="body2">
              Total plants selected for mom cut:{" "}
              <strong>{totalMomPlants}</strong>
            </Typography>
          </>
        )}

        {/* Submit button */}
        <Button variant="contained" type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Mom Batch"}
        </Button>

        {/* Success or error message */}
        {message && (
          <Alert severity={message.startsWith("Error") ? "error" : "success"}>
            {message}
          </Alert>
        )}
      </Stack>
    </>
  );

  return body;
}

export default CreateMomsForm;
