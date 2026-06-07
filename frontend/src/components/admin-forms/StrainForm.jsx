import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

// Add/edit/remove workflow for strain records.
// `embedded` decides inline form vs standalone card view.
function StrainForm({ embedded }) {
  // Mode drives both API method and visible fields.
  const [mode, setMode] = useState("add");
  const [strains, setStrains] = useState([]);
  const [selectedStrainId, setSelectedStrainId] = useState("");
  const [form, setForm] = useState({ name: "", type: "", status: "" });
  const [message, setMessage] = useState("");

  const fetchStrains = async () => {
    // Pull and alphabetize strain options for dropdowns.
    try {
      const res = await fetch("/api/strains");
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));
      setStrains(list);
    } catch (err) {
      console.error("Error fetching strains:", err);
    }
  };

  useEffect(() => {
    // Load initial strain list once when this form mounts.
    fetchStrains();
  }, []);

  const resetForm = () => {
    // Clear all controlled field values.
    setForm({ name: "", type: "", status: "" });
    setSelectedStrainId("");
  };

  const notifyStrainChange = () => {
    // Broadcast for other screens that derive data from strain list.
    window.dispatchEvent(new CustomEvent("strain:created"));
  };

  const handleModeChange = (nextMode) => {
    // Switching modes resets state so fields reflect the new workflow.
    setMode(nextMode);
    setMessage("");
    resetForm();
  };

  const handleSelectStrain = (strainId) => {
    // Load chosen strain details into edit/remove form state.
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

  // Route to POST/PATCH/DELETE depending on selected mode.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      let res;

      if (mode === "add") {
        // Add mode creates a brand-new strain.
        res = await fetch("/api/strains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            type: form.type || null,
            status: form.status || null,
          }),
        });
      }

      if (mode === "edit") {
        // Edit mode updates an existing strain record.
        if (!selectedStrainId) {
          throw new Error("Please select a strain to edit");
        }

        res = await fetch(`/api/strains/${selectedStrainId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            type: form.type || null,
            status: form.status || null,
          }),
        });
      }

      if (mode === "remove") {
        // Remove mode deletes the selected strain.
        if (!selectedStrainId) {
          throw new Error("Please select a strain to remove");
        }

        res = await fetch(`/api/strains/${selectedStrainId}`, {
          method: "DELETE",
        });
      }

      if (!res) {
        throw new Error("Invalid operation mode");
      }

      const getResponseError = async (response) => {
        // Defensive parsing helps surface backend errors cleanly in UI.
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            return errorData?.error || "Failed to save strain changes";
          } catch {
            return "Request failed with invalid JSON response";
          }
        }

        try {
          const text = await response.text();
          if (text.includes("<!DOCTYPE") || text.includes("<html")) {
            return "API returned HTML instead of JSON. Ensure backend is running and restarted after route changes.";
          }
          return text || "Failed to save strain changes";
        } catch {
          return "Failed to save strain changes";
        }
      };

      if (!res.ok) {
        throw new Error(await getResponseError(res));
      }

      if (mode !== "remove") {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          await res.json();
        }
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
        setMessage("Strain removed successfully.");
      }

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  };

  const formContent = (
    <>
      {/* Top controls choose operation mode and (when needed) target strain. */}
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
          // In edit/remove mode, user picks which existing strain to target.
          <TextField
            select
            label="Strain"
            value={selectedStrainId}
            onChange={(e) => handleSelectStrain(e.target.value)}
            required
          >
            <MenuItem value="">Select Strain</MenuItem>
            {strains.map((strain) => (
              // Dropdown rows are sourced from alphabetized strain list state.
              <MenuItem key={strain._id} value={strain._id}>
                {strain.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* Main form body changes based on add/edit/remove mode. */}
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
        {mode !== "remove" && (
          <>
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
          </>
        )}

        {mode === "remove" && (
          // Use Alert for destructive-action context before submit.
          <Alert severity="warning">
            This will permanently remove the selected strain if it is not
            referenced by existing records.
          </Alert>
        )}

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
      <Typography variant="h6">Strain Management</Typography>
      {formContent}
    </Stack>
  );
}

export default StrainForm;
