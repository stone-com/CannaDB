import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../utils/api";

// This form lets admins add, edit, or remove cannabis strain records.
// Users switch modes with a dropdown, fill in strain details, then submit the form.
function StrainForm() {
  const [mode, setMode] = useState("add");
  const [strains, setStrains] = useState([]);
  const [selectedStrainId, setSelectedStrainId] = useState("");
  const [form, setForm] = useState({ name: "", type: "", status: "" });
  const [message, setMessage] = useState("");

  // Loads all strains from the server and sorts them by name.
  const fetchStrains = async () => {
    try {
      const data = await apiGet("/api/strains");
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
      setStrains(list);
    } catch (err) {
      console.error("Error fetching strains:", err);
    }
  };

  useEffect(() => {
    fetchStrains();
  }, []);

  // Clears the form fields and selected strain.
  const resetForm = () => {
    setForm({ name: "", type: "", status: "" });
    setSelectedStrainId("");
  };

  // Tells other parts of the app that strain data may have changed.
  const notifyStrainChange = () => {
    window.dispatchEvent(new CustomEvent("strain:created"));
  };

  // Switches between add, edit, and remove modes and clears the form.
  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setMessage("");
    resetForm();
  };

  // Loads the selected strain's data into the form fields for editing.
  const handleSelectStrain = (strainId) => {
    setSelectedStrainId(strainId);
    const selected = strains.find(
      (strain) => String(strain._id) === String(strainId),
    );

    setForm({
      name: selected?.name || "",
      type: selected?.type || "",
      status: selected?.status || "",
    });
  };

  // Sends add, edit, or delete requests to the server based on the current mode.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (mode === "add") {
        await apiPost("/api/strains", {
          name: form.name.trim(),
          type: form.type || null,
          status: form.status || null,
        });
      }

      if (mode === "edit") {
        if (!selectedStrainId) {
          throw new Error("Please select a strain to edit");
        }

        await apiPatch(`/api/strains/${selectedStrainId}`, {
          name: form.name.trim(),
          type: form.type || null,
          status: form.status || null,
        });
      }

      if (mode === "remove") {
        if (!selectedStrainId) {
          throw new Error("Please select a strain to remove");
        }

        await apiDelete(`/api/strains/${selectedStrainId}`);
      }

      notifyStrainChange();
      await fetchStrains();

      if (mode === "add") {
        setForm({ name: "", type: "", status: "" });
        setMessage("Strain added successfully.");
      } else if (mode === "edit") {
        setMessage("Strain updated successfully.");
      } else {
        resetForm();
        setMessage(
          "Strain removed from batches, room assignments, and the strain list.",
        );
      }

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  };

  const formContent = (
    <>
      {/* Mode picker and strain selector */}
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select
          label="Mode"
          value={mode}
          onChange={(e) => handleModeChange(e.target.value)}
        >
          <MenuItem value="add">Add Strain</MenuItem>
          <MenuItem value="edit">Edit Strain</MenuItem>
          <MenuItem value="remove">Remove Strain</MenuItem>
        </TextField>

        {mode !== "add" && (
          <TextField
            select
            label="Strain"
            value={selectedStrainId}
            onChange={(e) => handleSelectStrain(e.target.value)}
            required
          >
            <MenuItem value="">Select Strain</MenuItem>
            {strains.map((strain) => (
              <MenuItem key={strain._id} value={strain._id}>
                {strain.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* Strain details form */}
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        {mode !== "remove" && (
          <>
            {/* Strain name */}
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            {/* Strain type (indica, sativa, etc.) */}
            <TextField
              select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <MenuItem value="">Select Type</MenuItem>
              <MenuItem value="indica">Indica</MenuItem>
              <MenuItem value="sativa">Sativa</MenuItem>
              <MenuItem value="hybrid">Hybrid</MenuItem>
              <MenuItem value="CBD">CBD</MenuItem>
            </TextField>

            {/* Strain status (production, bench, pheno) */}
            <TextField
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <MenuItem value="">Select Status</MenuItem>
              <MenuItem value="production">Production</MenuItem>
              <MenuItem value="bench">Bench</MenuItem>
              <MenuItem value="pheno">Pheno</MenuItem>
            </TextField>
          </>
        )}

        {/* Warning shown in remove mode */}
        {mode === "remove" && (
          <Alert severity="warning">
            This removes the strain and clears it from all batches and room
            assignments. Strains used in harvest records cannot be deleted.
          </Alert>
        )}

        {/* Submit button (label changes with mode) */}
        <Button
          type="submit"
          variant="contained"
          color={mode === "remove" ? "error" : "primary"}
        >
          {mode === "add" && "Add Strain"}
          {mode === "edit" && "Save Strain Changes"}
          {mode === "remove" && "Remove Strain"}
        </Button>
      </Stack>

      {/* Success or error message */}
      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </>
  );

  return formContent;
}

export default StrainForm;
