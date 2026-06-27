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
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { apiGet, apiPatch } from "../../utils/api";
import { formatDate } from "../../utils/formatDate";
import { getBatchStrainTotals } from "../../utils/batchHelpers";
import FormSection from "../ui/FormSection";
import FormSubmitBar from "../ui/FormSubmitBar";
import ListRow from "../ui/ListRow";
import RemoveButton from "../ui/RemoveButton";

const LIFECYCLE_STAGES = [
  "Clone",
  "Veg",
  "Flower",
  "Mom",
  "HarvestReady",
  "Drying",
  "Completed",
];

const BATCH_TYPES = ["production", "mom"];

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function EditBatchForm() {
  const [batches, setBatches] = useState([]);
  const [strains, setStrains] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [batchType, setBatchType] = useState("production");
  const [locationId, setLocationId] = useState("");
  const [cloneDate, setCloneDate] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [lifecycleStage, setLifecycleStage] = useState("Clone");
  const [stageStartedAt, setStageStartedAt] = useState("");
  const [plants, setPlants] = useState([]);
  const [syncAssignments, setSyncAssignments] = useState(true);
  const [clearHarvestId, setClearHarvestId] = useState(false);
  const [addStrainId, setAddStrainId] = useState("");
  const [addCount, setAddCount] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [batchData, strainData, locationData] = await Promise.all([
        apiGet("/api/batches"),
        apiGet("/api/strains"),
        apiGet("/api/locations"),
      ]);

      const list = Array.isArray(batchData) ? batchData : [];
      list.sort((a, b) =>
        (a?.batchNumber || "").localeCompare(b?.batchNumber || ""),
      );
      setBatches(list);
      setStrains(
        Array.isArray(strainData)
          ? [...strainData].sort((a, b) =>
              (a?.name || "").localeCompare(b?.name || ""),
            )
          : [],
      );
      setLocations(Array.isArray(locationData) ? locationData : []);
    } catch (error) {
      console.error("Error fetching edit batch data:", error);
    }
  };

  useEffect(() => {
    fetchData();

    const refresh = () => fetchData();
    window.addEventListener("batch:created", refresh);
    window.addEventListener("batch:updated", refresh);

    return () => {
      window.removeEventListener("batch:created", refresh);
      window.removeEventListener("batch:updated", refresh);
    };
  }, []);

  const selectableBatches = useMemo(
    () =>
      batches.filter(
        (batch) => String(batch?.lifecycleStage || "") !== "Completed",
      ),
    [batches],
  );

  const selectedBatch = useMemo(
    () =>
      selectableBatches.find(
        (batch) => String(batch._id) === String(selectedBatchId),
      ) || null,
    [selectableBatches, selectedBatchId],
  );

  const populateFormFromBatch = (batch) => {
    if (!batch) return;

    setBatchNumber(batch.batchNumber || "");
    setBatchType(batch.batchType || "production");
    setLocationId(String(batch.location?._id || batch.location || ""));
    setCloneDate(toDateInputValue(batch.cloneDate));
    setHarvestDate(toDateInputValue(batch.harvestDate));
    setLifecycleStage(batch.lifecycleStage || "Clone");
    setStageStartedAt(toDateInputValue(batch.stageStartedAt));
    setPlants(
      getBatchStrainTotals(batch).map((row) => ({
        strainId: row.strainId,
        count: row.count,
      })),
    );
    setSyncAssignments(true);
    setClearHarvestId(false);
    setAddStrainId("");
    setAddCount("");
    setMessage("");
  };

  const handleBatchChange = (batchId) => {
    setSelectedBatchId(batchId);
    const batch = selectableBatches.find(
      (entry) => String(entry._id) === String(batchId),
    );
    populateFormFromBatch(batch);
  };

  const handlePlantCountChange = (strainId, value) => {
    const count = Number(value);
    setPlants((prev) =>
      prev.map((plant) =>
        String(plant.strainId) === String(strainId)
          ? { ...plant, count: Number.isFinite(count) && count >= 0 ? count : 0 }
          : plant,
      ),
    );
  };

  const handleRemovePlant = (strainId) => {
    setPlants((prev) =>
      prev.filter((plant) => String(plant.strainId) !== String(strainId)),
    );
  };

  const handleAddPlant = () => {
    const numericCount = Number(addCount);
    if (!addStrainId || Number.isNaN(numericCount) || numericCount <= 0) {
      setMessage("Select a strain and enter a plant count greater than 0.");
      return;
    }

    setPlants((prev) => {
      const existingIndex = prev.findIndex(
        (plant) => String(plant.strainId) === String(addStrainId),
      );

      if (existingIndex === -1) {
        return [...prev, { strainId: addStrainId, count: numericCount }];
      }

      return prev.map((plant, index) =>
        index === existingIndex
          ? { ...plant, count: plant.count + numericCount }
          : plant,
      );
    });

    setAddStrainId("");
    setAddCount("");
    setMessage("");
  };

  const totalPlants = useMemo(
    () => plants.reduce((sum, plant) => sum + (Number(plant.count) || 0), 0),
    [plants],
  );

  const canSave =
    selectedBatchId &&
    batchNumber.trim() &&
    cloneDate &&
    plants.length > 0 &&
    totalPlants > 0;

  const handleSaveClick = () => {
    if (!canSave) {
      setMessage("Complete required fields and keep at least one plant in the batch.");
      return;
    }

    if (harvestDate && cloneDate && harvestDate < cloneDate) {
      setMessage("Harvest date cannot be before clone date.");
      return;
    }

    setMessage("");
    setConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!canSave) return;

    try {
      setIsSubmitting(true);

      const payload = {
        batchNumber: batchNumber.trim(),
        batchType,
        location: locationId || null,
        cloneDate,
        harvestDate: harvestDate || null,
        lifecycleStage,
        stageStartedAt: stageStartedAt || null,
        plants: plants.map((plant) => ({
          strainId: plant.strainId,
          count: Number(plant.count) || 0,
        })),
        syncAssignments,
      };

      if (clearHarvestId && selectedBatch?.harvestId) {
        payload.clearHarvestId = true;
      }

      const updatedBatch = await apiPatch(
        `/api/batches/${selectedBatchId}`,
        payload,
      );

      window.dispatchEvent(
        new CustomEvent("batch:updated", { detail: updatedBatch }),
      );

      setConfirmOpen(false);
      setMessage("Batch updated successfully.");
      await fetchData();

      if (String(updatedBatch?.lifecycleStage || "") === "Completed") {
        setSelectedBatchId("");
      } else {
        populateFormFromBatch(updatedBatch);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <FormSection
        title="Select batch"
        subtitle="Pick a batch to edit its metadata, lifecycle stage, and plant totals."
      >
        <TextField
          select
          label="Batch"
          value={selectedBatchId}
          onChange={(e) => handleBatchChange(e.target.value)}
          required
        >
          <MenuItem value="">Select batch</MenuItem>
          {selectableBatches.map((batch) => (
            <MenuItem key={batch._id} value={batch._id}>
              {batch.batchNumber} · {batch.lifecycleStage || "N/A"}
            </MenuItem>
          ))}
        </TextField>

        {selectedBatch ? (
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={selectedBatch.lifecycleStage || "N/A"} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={selectedBatch.batchType || "production"}
                />
                {selectedBatch.harvestId ? (
                  <Chip
                    size="small"
                    color="warning"
                    variant="outlined"
                    label="Linked to harvest"
                  />
                ) : null}
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Clone ${formatDate(selectedBatch.cloneDate)}`}
                />
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </FormSection>

      {selectedBatch ? (
        <>
          <FormSection title="Batch details">
            <TextField
              label="Batch number"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              required
            />

            <TextField
              select
              label="Batch type"
              value={batchType}
              onChange={(e) => setBatchType(e.target.value)}
            >
              {BATCH_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <MenuItem value="">No location</MenuItem>
              {locations.map((location) => (
                <MenuItem key={location._id} value={location._id}>
                  {location.nickname}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="date"
              label="Clone date"
              value={cloneDate}
              onChange={(e) => setCloneDate(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { placeholder: "" },
              }}
              required
            />

            <TextField
              type="date"
              label="Harvest date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { placeholder: "" },
              }}
            />

            <TextField
              select
              label="Lifecycle stage"
              value={lifecycleStage}
              onChange={(e) => setLifecycleStage(e.target.value)}
            >
              {LIFECYCLE_STAGES.map((stage) => (
                <MenuItem key={stage} value={stage}>
                  {stage}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="date"
              label="Stage started"
              value={stageStartedAt}
              onChange={(e) => setStageStartedAt(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { placeholder: "" },
              }}
              helperText="Used for time-in-stage reporting. Updates automatically when stage changes if left blank on save."
            />

            {selectedBatch.harvestId ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={clearHarvestId}
                    onChange={(e) => setClearHarvestId(e.target.checked)}
                  />
                }
                label="Clear harvest link (demo reset — batch can enter harvest flow again)"
              />
            ) : null}
          </FormSection>

          <FormSection
            title="Plants in batch"
            subtitle="Edit strain totals directly. Useful for demo setup and corrections."
          >
            <Stack spacing={1}>
              {plants.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No plants in this batch.
                </Typography>
              ) : (
                plants.map((plant) => {
                  const strain = strains.find(
                    (entry) => String(entry._id) === String(plant.strainId),
                  );

                  return (
                    <ListRow
                      key={plant.strainId}
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {strain?.name || "Unknown strain"}
                        </Typography>
                      }
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          type="number"
                          size="small"
                          label="Plants"
                          value={plant.count}
                          onChange={(e) =>
                            handlePlantCountChange(plant.strainId, e.target.value)
                          }
                          inputProps={{ min: 0 }}
                          sx={{ width: 120 }}
                        />
                        <RemoveButton
                          label="Remove strain from batch"
                          onClick={() => handleRemovePlant(plant.strainId)}
                        />
                      </Stack>
                    </ListRow>
                  );
                })
              )}
            </Stack>

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                select
                label="Add strain"
                value={addStrainId}
                onChange={(e) => setAddStrainId(e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="">Select strain</MenuItem>
                {strains.map((strain) => (
                  <MenuItem key={strain._id} value={strain._id}>
                    {strain.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                type="number"
                label="Count"
                value={addCount}
                onChange={(e) => setAddCount(e.target.value)}
                inputProps={{ min: 1 }}
                sx={{ width: { xs: "100%", sm: 140 } }}
              />

              <Button
                variant="outlined"
                onClick={handleAddPlant}
                sx={{ alignSelf: { sm: "center" } }}
              >
                Add
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary">
              Total plants: <strong>{totalPlants.toLocaleString()}</strong>
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={syncAssignments}
                  onChange={(e) => setSyncAssignments(e.target.checked)}
                />
              }
              label="Sync active room assignments to match these plant totals"
            />
          </FormSection>

          <FormSubmitBar
            type="button"
            disabled={!canSave || isSubmitting}
            onClick={handleSaveClick}
          >
            {isSubmitting ? "Saving…" : "Save batch changes"}
          </FormSubmitBar>
        </>
      ) : null}

      {message ? (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (isSubmitting) return;
          setConfirmOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm batch changes</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Typography variant="body2">
              Save manual edits to batch <strong>{batchNumber}</strong>?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stage: <strong>{lifecycleStage}</strong> · Plants:{" "}
              <strong>{totalPlants.toLocaleString()}</strong>
              {syncAssignments
                ? " · Active room assignments will be synced to the primary room"
                : ""}
              {clearHarvestId && selectedBatch?.harvestId
                ? " · Harvest link will be cleared"
                : ""}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Confirm save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default EditBatchForm;
