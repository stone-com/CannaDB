import { useEffect, useState } from "react";

// `embedded={true}` renders just the form fields (for AdminPanel accordion use).
// `embedded={false}` renders a standalone card with a heading.
function LocationForm({ embedded }) {
  const [companies, setCompanies] = useState([]);

  // All three fields in one state object.
  const [formData, setFormData] = useState({
    companyId: "",
    nickname: "",
    address: "",
  });
  const [message, setMessage] = useState("");

  // Can be called on load and whenever a company:created event fires.
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
    fetchCompanies();

    // Refresh the company dropdown when a new company is added.
    const handleCompanyCreated = () => fetchCompanies();
    window.addEventListener("company:created", handleCompanyCreated);
    return () =>
      window.removeEventListener("company:created", handleCompanyCreated);
  }, []);

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
          // `|| null` converts empty string to null for optional backend field.
          // Many mongoose schemas distinguish between "not provided" (null) and "empty string".
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

  if (embedded) {
    return (
      <>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">
              Company (required):
              <select
                className="form-select"
                value={formData.companyId}
                onChange={(e) =>
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
      </>
    );
  }

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
