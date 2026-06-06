import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

function CreateMomsForm({ embedded }) {
  const [batches, setBatches] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedMomRoomId, setSelectedMomRoomId] = useState("");
  const [momCuts, setMomCuts] = useState({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [batchRes, roomRes] = await Promise.all([
        fetch("/api/batches"),
        fetch("/api/rooms"),
      ]);

      const [batchData, roomData] = await Promise.all([
        batchRes.json(),
        roomRes.json(),
      ]);

      setBatches(Array.isArray(batchData) ? batchData : []);
      setRooms(Array.isArray(roomData) ? roomData : []);
    } catch (error) {
      console.error("Error loading create-moms form data:", error);
      setMessage("Error loading data.");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const productionBatches = useMemo(
    () =>
      batches
        .filter((batch) => batch.batchType === "production")
        .sort((a, b) =>
          (a.batchNumber || "").localeCompare(b.batchNumber || ""),
        ),
    [batches],
  );

  const selectedBatch = useMemo(
    () =>
      productionBatches.find(
        (batch) => String(batch._id) === String(selectedBatchId),
      ) || null,
    [productionBatches, selectedBatchId],
  );

  const availablePlantsByStrain = useMemo(() => {
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
    if (!selectedBatch?.location) return [];

    return rooms.filter(
      (room) =>
        room.type === "Mom" &&
        String(room?.locationId?._id) === String(selectedBatch.location),
    );
  }, [rooms, selectedBatch]);

  const handleBatchChange = (batchId) => {
    setSelectedBatchId(batchId);
    setMessage("");

    const chosenBatch = productionBatches.find(
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
    const normalized =
      value === "" ? "" : String(Math.max(0, Number(value) || 0));
    setMomCuts((prev) => ({ ...prev, [strainId]: normalized }));
  };

  const totalMomPlants = availablePlantsByStrain.reduce(
    (sum, strain) => sum + (Number(momCuts[strain.strainId]) || 0),
    0,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!selectedBatch) {
      setMessage("Please select a source production batch.");
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

      const res = await fetch(`/api/batches/${selectedBatch._id}/create-moms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          momRoomId: selectedMomRoomId,
          plants: plantsPayload,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create mom batch");
      }

      const result = await res.json();

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
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        <TextField
          select
          label="Source Production Batch"
          value={selectedBatchId}
          onChange={(e) => handleBatchChange(e.target.value)}
        >
          <MenuItem value="">Select Batch</MenuItem>
          {productionBatches.map((batch) => (
            <MenuItem key={batch._id} value={batch._id}>
              {batch.batchNumber} ({batch.lifecycleStage})
            </MenuItem>
          ))}
        </TextField>

        {selectedBatch && (
          <>
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

            <Typography variant="body2" color="text.secondary">
              Select how many plants from each strain to convert to moms.
            </Typography>

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

        <Button variant="contained" type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Mom Batch"}
        </Button>

        {message && (
          <Alert severity={message.startsWith("Error") ? "error" : "success"}>
            {message}
          </Alert>
        )}
      </Stack>
    </>
  );

  if (embedded) return body;

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Create Moms</Typography>
      {body}
    </Stack>
  );
}

export default CreateMomsForm;
