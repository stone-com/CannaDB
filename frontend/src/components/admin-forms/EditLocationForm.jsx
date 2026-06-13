import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

// Edit existing locations including company assignment and address metadata.
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

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!selectedLocationId) {
      setMessage("Error: Select a location to edit.");
      return;
    }

    try {
      const res = await fetch(`/api/locations/${selectedLocationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: formData.companyId,
          nickname: formData.nickname,
          address: formData.address || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update location");
      }

      const updatedLocation = await res.json();

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

      <TextField
        label="Nickname"
        value={formData.nickname}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, nickname: e.target.value }))
        }
        required
        disabled={!selectedLocationId}
      />

      <TextField
        label="Address"
        value={formData.address}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, address: e.target.value }))
        }
        disabled={!selectedLocationId}
      />

      <Button variant="contained" type="submit" disabled={!selectedLocationId}>
        Save Location Changes
      </Button>

      {message && (
        <Alert severity={message.startsWith("Error:") ? "error" : "success"}>
          {message}
        </Alert>
      )}
    </Stack>
  );

  return formContent;
}
