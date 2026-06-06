import { useState } from "react";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

// `embedded` decides inline form vs standalone card view.
function StrainForm({ embedded }) {
  // Form values.
  const [form, setForm] = useState({ name: "", type: "", status: "" });
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/strains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type || null,
          status: form.status || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add strain");
      }

      const savedStrain = await res.json();

      // Notify app to refresh strain data.
      window.dispatchEvent(
        new CustomEvent("strain:created", { detail: savedStrain }),
      );

      setForm({ name: "", type: "", status: "" });
      setMessage("Strain added successfully.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  };

  const formContent = (
    <>
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

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

        <Button type="submit" variant="contained">
          Add Strain
        </Button>
      </Stack>

      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </>
  );

  // Inline mode for accordion panels.
  if (embedded) return formContent;

  // Standalone page/card mode.
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Add Strain</Typography>
      {formContent}
    </Stack>
  );
}

export default StrainForm;
