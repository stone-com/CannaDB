import { useState } from "react";

// `embedded` decides inline form vs standalone card view.
function StrainForm({ embedded }) {
  // Form values.
  const [form, setForm] = useState({ name: "", type: "", status: "" });
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("/api/strains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type || null,
          status: form.status || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add strain");
      }

      const savedStrain = await res.json();

      // Notify app to refresh strain data.
      window.dispatchEvent(
        new CustomEvent("strain:created", { detail: savedStrain }),
      );

      setForm({ name: "", type: "", status: "" });
      setMessage("Strain added successfully.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Error: " + err.message);
    }
  };

  const formContent = (
    <>
      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label">
            Name (required):
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="form-input"
            />
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Type:
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="form-select"
            >
              <option value="">-- Select Type --</option>
              <option value="indica">Indica</option>
              <option value="sativa">Sativa</option>
              <option value="hybrid">Hybrid</option>
              <option value="CBD">CBD</option>
            </select>
          </label>
        </div>

        <div className="form-field">
          <label className="form-label">
            Status:
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="form-select"
            >
              <option value="">-- Select Status --</option>
              <option value="production">Production</option>
              <option value="bench">Bench</option>
              <option value="pheno">Pheno</option>
            </select>
          </label>
        </div>

        <button type="submit" className="submit-button">
          Add Strain
        </button>
      </form>

      {message && <p className="status-message">{message}</p>}
    </>
  );

  // Inline mode for accordion panels.
  if (embedded) return formContent;

  // Standalone page/card mode.
  return (
    <div className="form-container">
      <h2>Add Strain</h2>
      {formContent}
    </div>
  );
}

export default StrainForm;
