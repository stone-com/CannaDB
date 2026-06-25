import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { apiGet, apiPost } from "../../utils/api";

// This form lets admins create a new location tied to a company.
// Users pick a company, enter a nickname and address, then save the location.
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

  // Loads the company list from the server for the dropdown.
  const fetchCompanies = async () => {
    try {
      const data = await apiGet("/api/companies");
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
      const savedLocation = await apiPost("/api/locations", {
        companyId: formData.companyId,
        nickname: formData.nickname,
        address: formData.address || null,
      });

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
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      {/* Company picker */}
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

      {/* Location nickname */}
      <TextField
        label="Nickname"
        value={formData.nickname}
        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
        required
      />

      {/* Optional street address */}
      <TextField
        label="Address"
        value={formData.address}
        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
      />

      {/* Submit button */}
      <Button variant="contained" type="submit">
        Add Location
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

export default LocationForm;
