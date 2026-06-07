import { useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";

// Simple create form for company records.
// `embedded` decides inline form vs standalone card view.
function CompanyForm({ embedded }) {
  // Controlled field state.
  const [name, setName] = useState("");
  // Shared feedback message shown in Alert.
  const [message, setMessage] = useState("");

  // Submit one company and notify listeners so dependent forms can refresh.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add company");
      }

      const savedCompany = await res.json();

      // Let other forms refresh company data.
      window.dispatchEvent(
        new CustomEvent("company:created", {
          detail: savedCompany,
        }),
      );

      setName("");
      setMessage("Company added successfully.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const formContent = (
    // MUI Stack with component="form" gives vertical spacing + native submit behavior.
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <TextField
        label="Company Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
      />
      <Button variant="contained" type="submit">
        Add Company
      </Button>
      {/* Alert doubles as success/error feedback surface below the form. */}
      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );

  // In embedded mode, return just fields/buttons (no extra heading wrapper).
  if (embedded) return formContent;

  return (
    // Standalone mode wraps the same form with a local section title.
    <Stack spacing={2}>
      <Typography variant="h6">Add Company</Typography>
      {formContent}
    </Stack>
  );
}

export default CompanyForm;
