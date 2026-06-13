import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

// Create location records tied to a company.
function LocationForm() {
  // Dropdown source data.
  const [companies, setCompanies] = useState([]);

  // Form values.
  const [formData, setFormData] = useState({
    companyId: "",
    nickname: "",
    address: "",
  });
  const [message, setMessage] = useState("");

  // Load company options.
  const fetchCompanies = async () => {
    // Company list powers the location->company relationship dropdown.
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  useEffect(() => {
    // Populate company dropdown and keep it synced with company create events.
    fetchCompanies();

    // Refresh when a company is created.
    // Listen for cross-form creation events to keep options fresh.
    const handleCompanyCreated = () => fetchCompanies();
    window.addEventListener("company:created", handleCompanyCreated);
    return () =>
      window.removeEventListener("company:created", handleCompanyCreated);
  }, []);

  // Save the location and broadcast an event for dependent forms.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: formData.companyId,
          nickname: formData.nickname,
          // Send null for optional empty address.
          address: formData.address || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add location");
      }

      const savedLocation = await res.json();

      // Let other forms refresh location data.
      window.dispatchEvent(
        new CustomEvent("location:created", {
          detail: savedLocation,
        }),
      );

      setFormData({ companyId: "", nickname: "", address: "" });
      setMessage("Location added successfully.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const formContent = (
    // Form body for the location create workflow.
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <TextField
        select
        label="Company"
        value={formData.companyId}
        onChange={(e) =>
          setFormData({ ...formData, companyId: e.target.value })
        }
        required
      >
        <MenuItem value="">Select Company</MenuItem>
        {companies.map((company) => (
          <MenuItem key={company._id} value={company._id}>
            {company.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Nickname"
        value={formData.nickname}
        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
        required
      />

      <TextField
        label="Address"
        value={formData.address}
        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
      />

      <Button variant="contained" type="submit">
        Add Location
      </Button>

      {/* Inline status feedback keeps users in the same workflow context. */}
      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );

  return formContent;
}

export default LocationForm;
