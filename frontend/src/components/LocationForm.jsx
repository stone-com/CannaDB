import { useEffect, useState } from "react";

function LocationForm() {
  // Array state for dropdown options.
  const [companies, setCompanies] = useState([]);
  // Object state for form fields.
  const [formData, setFormData] = useState({
    companyId: "",
    nickname: "",
    address: "",
  });
  const [message, setMessage] = useState("");

  // Helper function called from useEffect and from event listeners.
  // Keeping it separate avoids duplicating fetch code.
  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  useEffect(() => {
    // Empty dependency array [] means this effect runs once after initial mount.
    // Initial dropdown load on mount.
    fetchCompanies();

    // Listen for custom event emitted by CompanyForm after successful create.
    const handleCompanyCreated = () => {
      fetchCompanies();
    };

    window.addEventListener("company:created", handleCompanyCreated);

    return () => {
      // Cleanup runs when component unmounts.
      window.removeEventListener("company:created", handleCompanyCreated);
    };
  }, []);

  const handleSubmit = async (e) => {
    // Submit location form data to backend.
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: formData.companyId,
          nickname: formData.nickname,
          // Convert empty string to null for optional backend field.
          address: formData.address || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add location");
      }

      const savedLocation = await res.json();

      // Notify other forms (like RoomForm) to refresh locations.
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

  return (
    <div className="form-container">
      <h2>Add Location</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label">
            Company (required):
            <select
              className="form-select"
              value={formData.companyId}
              onChange={(e) =>
                // Spread keeps existing fields and updates only one key.
                setFormData({ ...formData, companyId: e.target.value })
              }
              required
            >
              <option value="">-- Select Company --</option>
              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Nickname (required):
            <input
              className="form-input"
              type="text"
              value={formData.nickname}
              onChange={(e) =>
                setFormData({ ...formData, nickname: e.target.value })
              }
              required
            />
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Address:
            <input
              className="form-input"
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          </label>
        </div>

        <button className="submit-button" type="submit">
          Add Location
        </button>
      </form>
      {message && <p className="status-message">{message}</p>}
    </div>
  );
}

export default LocationForm;
