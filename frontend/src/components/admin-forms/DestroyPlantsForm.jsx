import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiGet, apiPost } from "../../utils/api";
import { getBatchStrainTotals } from "../../utils/batchHelpers";

// This form lets admins permanently remove plants from a batch by strain.
// It requires a confirmation dialog before the destructive action is sent to the server.
function DestroyPlantsForm() {
  // Controlled form fields and dialog state.
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedStrainId, setSelectedStrainId] = useState("");
  const [destroyCount, setDestroyCount] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Loads all batches from the server and sorts them for the dropdown.
  const fetchBatches = async () => {
    try {
      const data = await apiGet("/api/batches");
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) =>
        (a?.batchNumber || "").localeCompare(b?.batchNumber || ""),
      );
      setBatches(list);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  useEffect(() => {
    // Initial load + live refresh when batches are created/updated elsewhere.
    fetchBatches();

    const refresh = () => fetchBatches();
    window.addEventListener("batch:created", refresh);
    window.addEventListener("batch:updated", refresh);

    return () => {
      window.removeEventListener("batch:created", refresh);
      window.removeEventListener("batch:updated", refresh);
    };
  }, []);

  const selectedBatch = useMemo(
    // Resolve dropdown id into full batch object used by the UI.
    () =>
      batches.find((batch) => String(batch._id) === String(selectedBatchId)) ||
      null,
    [batches, selectedBatchId],
  );

  const strainTotals = useMemo(
    () => getBatchStrainTotals(selectedBatch),
    [selectedBatch],
  );

  const selectedStrain = useMemo(
    // Resolve strain id into selected strain totals row.
    () =>
      strainTotals.find(
        (row) => String(row.strainId) === String(selectedStrainId),
      ) || null,
    [strainTotals, selectedStrainId],
  );

  const canSubmit =
    // Basic client-side guard before opening confirmation dialog.
    selectedBatchId &&
    selectedStrainId &&
    Number(destroyCount) > 0 &&
    Number(destroyCount) <= Number(selectedStrain?.count || 0);

  // Clears strain and count fields when the user picks a different batch.
  const handleBatchChange = (batchId) => {
    setSelectedBatchId(batchId);
    setSelectedStrainId("");
    setDestroyCount("");
    setConfirmText("");
    setMessage("");
  };

  // Sends the destroy request to the server after the user confirms.
  const executeDestroy = async () => {
    const amount = Number(destroyCount);
    if (!canSubmit) {
      setMessage(
        "Please select a batch/strain and enter a valid destroy count.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await apiPost(
        `/api/batches/${selectedBatchId}/destroy-plants`,
        {
          strainId: selectedStrainId,
          count: amount,
          notes: notes.trim() || null,
        },
      );
      window.dispatchEvent(
        new CustomEvent("batch:updated", { detail: result.batch }),
      );

      setMessage("Plants destroyed successfully.");
      setConfirmOpen(false);
      setConfirmText("");
      setSelectedStrainId("");
      setDestroyCount("");
      setNotes("");
      await fetchBatches();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validates the form and opens the confirmation dialog.
  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage("");

    if (!canSubmit) {
      setMessage(
        "Please select a batch/strain and enter a valid destroy count.",
      );
      return;
    }

    setConfirmText("");
    setConfirmOpen(true);
  };

  const content = (
    // Form + confirmation dialog pattern for destructive actions.
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      {/* Batch picker */}
      <TextField
        select
        label="Batch"
        value={selectedBatchId}
        onChange={(e) => handleBatchChange(e.target.value)}
        required
      >
        <MenuItem value="">Select Batch</MenuItem>
        {batches.map((batch) => (
          // Show batch number and stage so operators pick the correct source batch.
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
                color="primary"
                variant="outlined"
              />
            </Stack>
          </MenuItem>
        ))}
      </TextField>

      {/* Selected batch summary card */}
      {selectedBatch && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Batch: <strong>{selectedBatch.batchNumber}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a strain and how many plants to remove from this batch.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Strain picker */}
      <TextField
        select
        label="Strain"
        value={selectedStrainId}
        onChange={(e) => {
          setSelectedStrainId(e.target.value);
          setDestroyCount("");
          setMessage("");
        }}
        required
        disabled={!selectedBatchId}
      >
        {/* Strains list updates dynamically from selected batch totals. */}
        <MenuItem value="">Select Strain</MenuItem>
        {strainTotals.map((row) => (
          // Each option includes currently available count for quick validation.
          <MenuItem key={row.strainId} value={row.strainId}>
            {row.strainName} (Available: {row.count})
          </MenuItem>
        ))}
      </TextField>

      {/* Number of plants to destroy */}
      <TextField
        type="number"
        label="Plants To Destroy"
        value={destroyCount}
        onChange={(e) => setDestroyCount(e.target.value)}
        inputProps={{ min: 1, max: selectedStrain?.count || undefined }}
        disabled={!selectedStrainId}
        required
      />

      {selectedStrain && (
        <Typography variant="caption" color="text.secondary">
          Available in batch: {selectedStrain.count}
        </Typography>
      )}

      {/* Optional notes field */}
      <TextField
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        multiline
        minRows={2}
      />

      <Divider />

      {/* Submit button (opens confirmation dialog) */}
      <Button
        type="submit"
        variant="contained"
        color="error"
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? "Destroying..." : "Destroy Plants"}
      </Button>

      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}

      {/* Confirmation dialog before destroying plants */}
      <Dialog
        open={confirmOpen}
        onClose={() => {
          // Block accidental close while request is currently being submitted.
          if (isSubmitting) return;
          setConfirmOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        {/* MUI Dialog provides a clear secondary confirmation step. */}
        <DialogTitle>Confirm Plant Destruction</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Typography variant="body2">
              You are about to remove <strong>{destroyCount || 0}</strong>{" "}
              plants from strain{" "}
              <strong>{selectedStrain?.strainName || "N/A"}</strong>
              in batch <strong>{selectedBatch?.batchNumber || "N/A"}</strong>.
            </Typography>
            <Typography variant="body2" color="error.main">
              This action updates batch totals in the database.
            </Typography>
            <TextField
              label="Type DESTROY to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={
              isSubmitting || confirmText.trim().toUpperCase() !== "DESTROY"
            }
            onClick={executeDestroy}
          >
            {isSubmitting ? "Destroying..." : "Confirm Destroy"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );

  return content;
}

export default DestroyPlantsForm;
