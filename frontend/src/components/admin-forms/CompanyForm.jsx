import { useState } from "react";

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

  if (embedded) {
    return (
      <>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">
              Company Name (required):
              <input
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          </div>
          <button className="submit-button" type="submit">
            Add Company
          </button>
        </form>
        {message && <p className="status-message">{message}</p>}
      </>
    );
  }

  return (
    <div className="form-container">
      <h2>Add Company</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label">
            Company Name (required):
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        </div>

        <button className="submit-button" type="submit">
          Add Company
        </button>
      </form>
      {message && <p className="status-message">{message}</p>}
    </div>
  );
}

export default CompanyForm;
