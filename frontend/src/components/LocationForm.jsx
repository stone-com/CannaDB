import { useEffect, useState } from "react";

// LocationForm creates a new facility location linked to a company.
// The `embedded` prop works the same as in CompanyForm:
//   embedded={true}  → no wrapper div/heading (for accordion use)
//   embedded={false} → standalone card with heading
function LocationForm({ embedded }) {
  // companies holds the list of options for the Company dropdown.
  // It starts empty and gets filled when the component loads.
  const [companies, setCompanies] = useState([]);

  // formData holds all three form fields in one object instead of three separate states.
  // This is a common pattern for forms with multiple fields — easier to pass around
  // and reset all at once. Update one field at a time using the spread pattern:
  // setFormData({ ...formData, nickname: newValue })
  const [formData, setFormData] = useState({
    companyId: "",
    nickname: "",
    address: "",
  });
  const [message, setMessage] = useState("");

  // fetchCompanies is defined as its own function (not inline in useEffect) so it
  // can be called from two places: on initial load, and whenever a new company is created.
  // This avoids copy-pasting the same fetch logic twice.
  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies");
      const data = await res.json();
      // Defensive check: only store the data if it's actually an array.
      // If the server returned something unexpected, default to empty array.
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  useEffect(() => {
    // useEffect runs after the component renders.
    // The empty array [] as the second argument means:
    // "run this effect once, when the component first appears on the page."
    // If you put variables in the array, the effect would re-run when those change.
    fetchCompanies();

    // Subscribe to a custom browser event fired by CompanyForm.
    // When a new company is created, we refresh the dropdown so it appears immediately.
    const handleCompanyCreated = () => {
      fetchCompanies();
    };
    window.addEventListener("company:created", handleCompanyCreated);

    // The return value of useEffect is a "cleanup function".
    // React runs it when this component is removed from the page (unmounted).
    // Removing the listener prevents memory leaks and phantom events.
    // If we didn't clean up, old listeners would pile up every time this component
    // is mounted and unmounted (like when navigating between pages).
    return () => {
      window.removeEventListener("company:created", handleCompanyCreated);
    };
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
