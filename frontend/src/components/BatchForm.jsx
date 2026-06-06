import React, { useState, useEffect } from "react";
import {
  Alert,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
function BatchForm() {
  //dropdown state for strains
  const [selectedStrain, setSelectedStrain] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [cloneDate, setCloneDate] = useState("");
  const [count, setCount] = useState("");
  const [plants, setPlants] = useState([]);
  const [strains, setStrains] = useState([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    async function fetchStrains() {
      try {
        const response = await fetch("/api/strains");
        const data = await response.json();
        setStrains(data);
      } catch (error) {
        console.error("Error fetching strains:", error);
      }
    }
    fetchStrains();
  }, []);

  function addPlant() {
    if (!selectedStrain || !count) return;
    setPlants([...plants, { strainId: selectedStrain, count: Number(count) }]);
    setSelectedStrain("");
    setCount("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!batchNumber || !cloneDate || plants.length === 0) {
      setMessage("Please complete all required fields.");
      return;
    }
    const payload = {
      batchNumber,
      harvestDate,
      cloneDate,
      plants,
    };
    try {
      const response = await fetch("/api/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Batch submit failed");

      setMessage("Batch submitted successfully!");

      setBatchNumber("");
      setHarvestDate("");
      setCloneDate("");
      setSelectedStrain("");
      setCount("");
      setPlants([]);
    } catch (error) {
      console.error("Error submitting batch form:", error);
      setMessage("Error submitting batch form.");
    }
  }

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <Typography variant="h6">Create New Batch</Typography>
      <TextField
        label="Batch Number"
        value={batchNumber}
        onChange={(e) => setBatchNumber(e.target.value)}
      />
      <TextField
        type="date"
        label="Clone Date"
        value={cloneDate}
        onChange={(e) => setCloneDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        type="date"
        label="Harvest Date"
        value={harvestDate}
        onChange={(e) => setHarvestDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />

      <Divider />

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
        label="Count"
        value={count}
        onChange={(e) => setCount(e.target.value)}
      />

      <Button type="button" variant="outlined" onClick={addPlant}>
        Add Plant
      </Button>

      <Divider />

      <Typography variant="subtitle1">Plants Added</Typography>
      <Typography variant="body2">
        Total Plants: {plants.reduce((sum, p) => sum + p.count, 0)}
      </Typography>

      {plants.map((p, i) => {
        const strain = strains.find((s) => s._id === p.strainId);
        return (
          <Stack
            key={i}
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body2">
              {strain ? strain.name : "Unknown Strain"} - {p.count}
            </Typography>
            <Button
              type="button"
              color="error"
              onClick={() => {
                setPlants(plants.filter((_, idx) => idx !== i));
              }}
            >
              Remove
            </Button>
          </Stack>
        );
      })}

      <Button type="submit" variant="contained">
        Submit Batch
      </Button>

      {message && (
        <Alert severity={message.startsWith("Error") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );
}

export default BatchForm;
