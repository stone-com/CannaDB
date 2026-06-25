import { useState } from "react";
import { Alert, Button, Stack, TextField } from "@mui/material";
import { apiPost } from "../../utils/api";

// This form lets admins add a new company by entering its name.
// On success it clears the field and shows a confirmation message.
function CompanyForm() {
  // Controlled field state.
  const [name, setName] = useState("");
  // Shared feedback message shown in Alert.
  const [message, setMessage] = useState("");

  // Submit one company and notify listeners so dependent forms can refresh.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const savedCompany = await apiPost("/api/companies", {
        name: name.trim(),
      });

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
      {/* Company name input */}
      <TextField
        label="Company Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
      />
      {/* Submit button */}
      <Button variant="contained" type="submit">
        Add Company
      </Button>
      {/* Success or error message */}
      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );

  return formContent;
}

export default CompanyForm;
