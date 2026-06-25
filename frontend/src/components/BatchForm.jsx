/**
 * BatchForm — create a new batch with dates, location, and strain plant counts.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiGet, apiPost } from "../utils/api";
import FormSection from "./ui/FormSection";
import FormSubmitBar from "./ui/FormSubmitBar";
import ListRow from "./ui/ListRow";
import RemoveButton from "./ui/RemoveButton";

function BatchForm() {
  // --- Form field state (each input is controlled by React) ---
  const [selectedStrain, setSelectedStrain] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [cloneDate, setCloneDate] = useState("");
  const [count, setCount] = useState("");
  const [plants, setPlants] = useState([]);
  const [strains, setStrains] = useState([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [locations, setLocations] = useState([]);

  // Load dropdown options when the form first mounts.
  useEffect(() => {
    async function fetchStrains() {
      try {
        const data = await apiGet("/api/strains");
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

    async function fetchLocations() {
      try {
        const data = await apiGet("/api/locations");
        setLocations(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    }

    fetchStrains();
    fetchLocations();
  }, []);

  const totalPlants = useMemo(
    () => plants.reduce((sum, plant) => sum + plant.count, 0),
    [plants],
  );

  const canSubmit =
    batchNumber.trim() && cloneDate && selectedLocation && plants.length > 0;

  // Add one strain row; duplicate strains merge into one total count.
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
      location: selectedLocation,
    };

    try {
      setIsSubmitting(true);
      const savedBatch = await apiPost("/api/batches", payload);
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
      setSelectedLocation("");
    } catch (error) {
      console.error("Error submitting batch form:", error);
      setMessage(`Error: ${error.message || "Error submitting batch form."}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
      <Typography variant="h6">Create New Batch</Typography>

      {/* Section 1: batch identity and schedule */}
      <FormSection
        title="Batch Details"
        subtitle="New batches start in the Clone room at the selected location."
      >
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

        <TextField
          select
          label="Location"
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          required
        >
          <MenuItem value="">Select a location</MenuItem>
          {locations.map((location) => (
            <MenuItem key={location._id} value={location._id}>
              {location.nickname}
            </MenuItem>
          ))}
        </TextField>
      </FormSection>

      {/* Section 2: build the plant list strain by strain */}
      <FormSection
        title="Plants in Batch"
        subtitle="Add each strain and count before submitting."
      >
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

        <Typography variant="body2" color="text.secondary">
          Total plants: <strong>{totalPlants}</strong>
        </Typography>

        {plants.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No strains added yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {plants.map((plant, index) => {
              const strain = strains.find((s) => s._id === plant.strainId);
              return (
                <ListRow
                  key={`${plant.strainId}-${index}`}
                  label={
                    <Typography variant="body2">
                      {strain ? strain.name : "Unknown Strain"} —{" "}
                      <strong>{plant.count}</strong> plants
                    </Typography>
                  }
                >
                  <RemoveButton
                    label="Remove strain from batch"
                    onClick={() => {
                      setPlants((prev) =>
                        prev.filter((_, plantIndex) => plantIndex !== index),
                      );
                    }}
                  />
                </ListRow>
              );
            })}
          </Stack>
        )}
      </FormSection>

      <FormSubmitBar disabled={!canSubmit || isSubmitting}>
        {isSubmitting ? "Saving..." : "Submit Batch"}
      </FormSubmitBar>

      {message ? (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      ) : null}
    </Stack>
  );
}

export default BatchForm;
