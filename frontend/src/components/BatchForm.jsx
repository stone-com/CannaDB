import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
function BatchForm() {
  const [selectedStrain, setSelectedStrain] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [cloneDate, setCloneDate] = useState("");
  const [count, setCount] = useState("");
  const [plants, setPlants] = useState([]);
  const [strains, setStrains] = useState([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchStrains() {
      try {
        const response = await fetch("/api/strains");
        const data = await response.json();
        const sorted = Array.isArray(data)
          ? [...data].sort((a, b) =>
              (a?.name || "").localeCompare(b?.name || ""),
            )
          : [];
        setStrains(sorted);
      } catch (error) {
        console.error("Error fetching strains:", error);
      }
    }
    fetchStrains();
  }, []);

  const totalPlants = useMemo(
    () => plants.reduce((sum, plant) => sum + plant.count, 0),
    [plants],
  );

  const canSubmit = batchNumber.trim() && cloneDate && plants.length > 0;

  function addPlant() {
    const numericCount = Number(count);
    if (!selectedStrain || Number.isNaN(numericCount) || numericCount <= 0) {
      setMessage(
        "Please select a strain and enter a plant count greater than 0.",
      );
      return;
    }

    setPlants((prev) => {
      const existingIndex = prev.findIndex(
        (plant) => String(plant.strainId) === String(selectedStrain),
      );

      if (existingIndex === -1) {
        return [...prev, { strainId: selectedStrain, count: numericCount }];
      }

      return prev.map((plant, index) =>
        index === existingIndex
          ? { ...plant, count: plant.count + numericCount }
          : plant,
      );
    });

    setMessage("");
    setSelectedStrain("");
    setCount("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (harvestDate && cloneDate && harvestDate < cloneDate) {
      setMessage("Harvest date cannot be before clone date.");
      return;
    }

    const payload = {
      batchNumber: batchNumber.trim(),
      harvestDate: harvestDate || null,
      cloneDate,
      plants,
    };

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData?.error || "Batch submit failed");
        }
        throw new Error("Batch submit failed");
      }

      const savedBatch = await response.json();
      window.dispatchEvent(
        new CustomEvent("batch:created", { detail: savedBatch }),
      );

      setMessage("Batch submitted successfully!");

      setBatchNumber("");
      setHarvestDate("");
      setCloneDate("");
      setSelectedStrain("");
      setCount("");
      setPlants([]);
    } catch (error) {
      console.error("Error submitting batch form:", error);
      setMessage(`Error: ${error.message || "Error submitting batch form."}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <Typography variant="h6">Create New Batch</Typography>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Batch Number"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              required
            />

            <TextField
              type="date"
              label="Clone Date"
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
              label="Harvest Date"
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { placeholder: "" },
              }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Add Plants</Typography>

            <TextField
              select
              label="Strain"
              value={selectedStrain}
              onChange={(e) => setSelectedStrain(e.target.value)}
            >
              <MenuItem value="">Select a strain</MenuItem>
              {strains.map((strain) => (
                <MenuItem key={strain._id} value={strain._id}>
                  {strain.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="number"
              label="Plant Count"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              inputProps={{ min: 1 }}
            />

            <Button type="button" variant="outlined" onClick={addPlant}>
              Add to Batch
            </Button>

            <Divider />

            <Typography variant="subtitle2">Plants in Batch</Typography>
            <Typography variant="body2" color="text.secondary">
              Total plants: {totalPlants}
            </Typography>

            {plants.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No strains added yet.
              </Typography>
            ) : (
              plants.map((plant, index) => {
                const strain = strains.find((s) => s._id === plant.strainId);
                return (
                  <Stack
                    key={`${plant.strainId}-${index}`}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      p: 1.25,
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2">
                      {strain ? strain.name : "Unknown Strain"}: {plant.count}
                    </Typography>
                    <Button
                      type="button"
                      color="error"
                      size="small"
                      onClick={() => {
                        setPlants((prev) =>
                          prev.filter((_, plantIndex) => plantIndex !== index),
                        );
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                );
              })
            )}
          </Stack>
        </CardContent>
      </Card>

      <Button
        type="submit"
        variant="contained"
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Submit Batch"}
      </Button>

      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );
}

export default BatchForm;
