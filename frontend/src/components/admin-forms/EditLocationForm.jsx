import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { apiGet, apiPut } from "../../utils/api";

// This form lets admins edit an existing location's company, nickname, and address.
// Users pick a location from a dropdown, change the fields, then save the updates.
export default function EditLocationForm() {
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [formData, setFormData] = useState({
    companyId: "",
    nickname: "",
    address: "",
  });
  const [message, setMessage] = useState("");

  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        id: location._id,
        companyName: location?.companyId?.name || "Unknown Company",
        nickname: location.nickname || "Unnamed Location",
        address: location.address || "",
        companyId: location?.companyId?._id || "",
      })),
    [locations],
  );

  // Loads the company list from the server for the dropdown.
  const fetchCompanies = async () => {
    try {
      const data = await apiGet("/api/companies");
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  // Loads all locations from the server for the location picker.
  const fetchLocations = async () => {
    try {
      const data = await apiGet("/api/locations");
      setLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchLocations();

    const handleCompanyCreated = () => fetchCompanies();
    const handleLocationCreated = () => fetchLocations();

    window.addEventListener("company:created", handleCompanyCreated);
    window.addEventListener("location:created", handleLocationCreated);

    return () => {
      window.removeEventListener("company:created", handleCompanyCreated);
      window.removeEventListener("location:created", handleLocationCreated);
    };
  }, []);

  // Fills the form fields when the user selects a location to edit.
  const handleLocationChange = (locationId) => {
    setSelectedLocationId(locationId);
    setMessage("");

    const selected = locationOptions.find(
      (location) => location.id === locationId,
    );
    if (!selected) {
      setFormData({ companyId: "", nickname: "", address: "" });
      return;
    }

    setFormData({
      companyId: selected.companyId,
      nickname: selected.nickname,
      address: selected.address,
    });
  };

  // Sends the updated location data to the server.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!selectedLocationId) {
      setMessage("Error: Select a location to edit.");
      return;
    }

    try {
      const updatedLocation = await apiPut(
        `/api/locations/${selectedLocationId}`,
        {
          companyId: formData.companyId,
          nickname: formData.nickname,
          address: formData.address || null,
        },
      );

      window.dispatchEvent(
        new CustomEvent("location:updated", {
          detail: updatedLocation,
        }),
      );

      await fetchLocations();
      setMessage("Location updated successfully.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const formContent = (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      {/* Location picker */}
      <TextField
        select
        label="Location to Edit"
        value={selectedLocationId}
        onChange={(e) => handleLocationChange(e.target.value)}
        required
      >
        <MenuItem value="">Select Location</MenuItem>
        {locationOptions.map((location) => (
          <MenuItem key={location.id} value={location.id}>
            {location.companyName} - {location.nickname}
          </MenuItem>
        ))}
      </TextField>

      {/* Company assignment */}
      <TextField
        select
        label="Company"
        value={formData.companyId}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, companyId: e.target.value }))
        }
        required
        disabled={!selectedLocationId}
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
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, nickname: e.target.value }))
        }
        required
        disabled={!selectedLocationId}
      />

      {/* Street address */}
      <TextField
        label="Address"
        value={formData.address}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, address: e.target.value }))
        }
        disabled={!selectedLocationId}
      />

      {/* Save button */}
      <Button variant="contained" type="submit" disabled={!selectedLocationId}>
        Save Location Changes
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
