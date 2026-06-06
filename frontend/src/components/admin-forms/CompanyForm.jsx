import { useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";

// `embedded` decides inline form vs standalone card view.
function CompanyForm({ embedded }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

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
      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );

  if (embedded) return formContent;

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Add Company</Typography>
      {formContent}
    </Stack>
  );
}

export default CompanyForm;
