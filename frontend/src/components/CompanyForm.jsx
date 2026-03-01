import { useState } from "react";

function CompanyForm() {
  // useState stores values between renders.
  // When setName/setMessage runs, React re-renders this component.
  // Controlled input: React state is the source of truth for the input value.
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  // This function runs when the <form> is submitted.
  // Submit a new company and notify other forms to refresh their company lists.
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
        // Throwing an error jumps to the catch block.
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add company");
      }

      // Parse JSON response body.
      const savedCompany = await res.json();

      // Emit a custom browser event so other components can refresh related dropdowns.
      window.dispatchEvent(
        new CustomEvent("company:created", {
          detail: savedCompany,
        }),
      );

      setName("");
      // This message is shown in the JSX below when truthy.
      setMessage("Company added successfully.");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

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
