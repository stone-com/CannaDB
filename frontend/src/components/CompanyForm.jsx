import { useState } from "react";

// CompanyForm creates a new company record in the database.
//
// The `embedded` prop controls how this component renders:
//   embedded={true}  → renders just the form fields with no wrapper (for use inside AdminPanel accordion)
//   embedded={false} → renders a standalone card with an "Add Company" heading
// Writing just `<CompanyForm embedded />` is shorthand for `<CompanyForm embedded={true} />`.
function CompanyForm({ embedded }) {
  // `name` is a controlled input — React state is the "source of truth".
  // This means the input always displays what's in state, and any typing
  // immediately updates state via onChange. React owns the value; the DOM doesn't.
  const [name, setName] = useState("");

  // `message` holds success or error text shown after the form is submitted.
  // Empty string ("") is falsy, so the message paragraph stays hidden until set.
  const [message, setMessage] = useState("");

  // handleSubmit runs when the form is submitted.
  // `async` means this function contains `await` calls (things that take time).
  const handleSubmit = async (e) => {
    // e is the browser submit event.
    // e.preventDefault() stops the page from refreshing on submit.
    e.preventDefault();
    setMessage(""); // Clear any previous message before trying again.

    try {
      // fetch() sends an HTTP POST request to the backend.
      // method: "POST" — creating new data
      // headers tells the server the request body is JSON
      // body: JSON.stringify() converts the JS object to a text string
      // .trim() removes whitespace from both ends of the string
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        // res.ok is false when the server responds with an error status (400, 500, etc.).
        // Throwing here jumps straight to the catch block below.
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add company");
      }

      // If we got here, the request succeeded. Parse the saved company from the response.
      const savedCompany = await res.json();

      // window.dispatchEvent fires a custom browser event.
      // new CustomEvent("company:created", ...) creates an event with a name we made up.
      // The `detail` property carries extra data (the saved company object).
      // LocationForm is listening for this event — when it fires, the location dropdown
      // automatically refreshes to include the new company. No prop drilling needed!
      window.dispatchEvent(
        new CustomEvent("company:created", {
          detail: savedCompany,
        }),
      );

      setName(""); // Clear the input field.
      setMessage("Company added successfully.");
    } catch (error) {
      // Template literal: backtick strings let you embed variables with ${...}.
      // `Error: ${error.message}` inserts the actual error message text.
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
