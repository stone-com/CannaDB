import { useState } from "react";
import CompanyForm from "./CompanyForm";
import LocationForm from "./LocationForm";
import RoomForm from "./RoomForm";

// This array isn't actively looped over in the JSX below, but it's a useful
// reference that documents all the section keys used in this file.
// Keeping config data like this near the top is a common pattern — if you ever
// need to rename a section label, you know exactly where to look.
const SECTIONS = [
  { key: "strain", label: "Add New Strain" },
  { key: "company", label: "Add Company" },
  { key: "location", label: "Add Location" },
  { key: "room", label: "Add Room" },
];

// AccordionSection is a small helper component defined right here in this file.
// It's NOT exported — it's only used by AdminPanel below.
//
// A component is just a function that returns JSX. Think of this one as a
// reusable "expandable section" widget. It takes 4 props:
//   label     – text shown on the clickable header button
//   isOpen    – true/false value coming from AdminPanel's state
//   onToggle  – function to call when the header is clicked
//   children  – whatever JSX you put between <AccordionSection>...</AccordionSection>
//
// The "children" prop is special in React — it automatically contains anything
// nested inside a component's opening and closing tags.
function AccordionSection({ label, isOpen, onToggle, children }) {
  return (
    <div className="accordion-item">
      {/* Clicking this button calls onToggle, which is defined in AdminPanel */}
      <button className="accordion-trigger" onClick={onToggle}>
        {label}
        {/* Template literal: the backtick string `accordion-arrow${...}` builds
            a CSS class name dynamically. The ternary inside reads:
            "if isOpen is true, add the string ' open' to the class, otherwise add nothing" */}
        <span className={`accordion-arrow${isOpen ? " open" : ""}`}>▼</span>
      </button>
      {/* The && operator is a shortcut for conditional rendering.
          React only renders the right side when the left side is truthy.
          So this div only appears when isOpen is true. */}
      {isOpen && <div className="accordion-body">{children}</div>}
    </div>
  );
}

// AdminPanel is exported as "default" so App.jsx can import it.
// It's the full admin controls page — one big collapsible accordion menu of forms.
export default function AdminPanel() {
  // openSection tracks which accordion section the user currently has open.
  // null means nothing is open (all sections collapsed).
  // A string like "strain" means that section's body is visible.
  const [openSection, setOpenSection] = useState(null);

  // The strain form lives directly in AdminPanel (no separate component) because
  // it's simple enough to inline here.
  // formData is one object holding all three strain fields together.
  // When you need to update one field, you use the spread pattern to copy the
  // existing object and overwrite only the changed field:
  //   { ...formData, name: newValue }
  const [formData, setFormData] = useState({ name: "", type: "", status: "" });

  // message holds feedback text shown after form submission.
  // Empty string "" is falsy in JS, so `{message && <p>...}` hides the paragraph
  // when message is empty and shows it when a value is set.
  const [message, setMessage] = useState("");

  // toggle opens a section if it's closed, or closes it if it's already open.
  // It uses a "functional state update" — the arrow function receives `prev`
  // (the current value of openSection) as its argument.
  // The ternary inside reads:
  //   "if the section being toggled is already the open one → close it (null)"
  //   "otherwise → set it as the open section"
  // This ensures only one section can be open at a time.
  const toggle = (key) => setOpenSection((prev) => (prev === key ? null : key));

  // handleSubmit is "async" because it talks to the server, which takes time.
  // The "await" keyword pauses execution until the network request finishes.
  // Think of async/await like: "hold on, wait for this before moving on."
  const handleSubmit = async (e) => {
    // e is the browser form submit event.
    // e.preventDefault() stops the browser's default behavior of reloading
    // the page when a form is submitted. Without this, the page would refresh
    // and wipe out all your React state.
    e.preventDefault();
    try {
      // fetch() sends an HTTP request to the backend API.
      // method: "POST" means we're creating a new record (not just reading one).
      // headers tells the server the data is in JSON format.
      // body: JSON.stringify(...) converts our JS object into a string the
      // server can understand. JSON is just a text format for data — like a
      // typed-out version of a JavaScript object.
      const res = await fetch("/api/strains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          // `|| null` is a fallback: if formData.type is an empty string (falsy),
          // use null instead. The backend expects null for optional fields,
          // not an empty string.
          type: formData.type || null,
          status: formData.status || null,
        }),
      });
      if (res.ok) {
        // res.json() reads the response body and converts it from JSON text
        // back into a JavaScript object.
        const savedStrain = await res.json();

        // window.dispatchEvent fires a browser-level custom event.
        // new CustomEvent("strain:created", ...) creates an event with a name we chose.
        // The `detail` property lets us attach data to the event.
        // App.jsx is listening for this event and will re-fetch data when it fires.
        // This is how forms trigger data refreshes without needing a global state manager.
        window.dispatchEvent(
          new CustomEvent("strain:created", { detail: savedStrain }),
        );
        // Reset all form fields back to empty strings.
        setFormData({ name: "", type: "", status: "" });
        setMessage("Strain added successfully.");
        // setTimeout runs a function after a delay. 3000 = 3000 milliseconds = 3 seconds.
        // After 3 seconds, the success message clears itself.
        setTimeout(() => setMessage(""), 3000);
      } else {
        const error = await res.json();
        setMessage("Error: " + error.error);
      }
    } catch (err) {
      // The catch block runs if anything in the try block throws an error —
      // for example, if the user is offline and fetch() fails.
      setMessage("Error adding strain: " + err.message);
    }
  };

  return (
    <div className="admin-panel">
      <h1>Admin Controls</h1>
      <p className="admin-panel-subtitle">
        Select a section to expand it and add new records.
      </p>

      <div className="admin-accordion">
        {/* Each AccordionSection gets three "props" (inputs):
              label    – the header button text
              isOpen   – true only when this section's key matches openSection state
              onToggle – arrow function that calls toggle() with this section's key
            The form content goes between the opening and closing tags
            and becomes the `children` prop inside AccordionSection. */}
        <AccordionSection
          label="Add New Strain"
          isOpen={openSection === "strain"}
          onToggle={() => toggle("strain")}
        >
          {/* The strain form lives directly here as inline JSX.
              onChange on each field calls setFormData with the spread pattern:
              { ...formData, fieldName: newValue } — copies everything, changes one thing. */}
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label">
                Name (required):
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="form-input"
                />
              </label>
            </div>
            <div className="form-field">
              <label className="form-label">
                Type:
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
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
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
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
          {/* {message && <p>...} is short for: if message has a value, show the paragraph.
              It stays hidden when message is an empty string. */}
          {message && <p className="status-message">{message}</p>}
        </AccordionSection>

        {/* The sections below render other form components using the `embedded` prop.
            When embedded={true}, those components skip rendering their own wrapper
            div and heading, since the accordion already provides the container.
            Writing `embedded` without a value is shorthand for `embedded={true}`. */}
        <AccordionSection
          label="Add Company"
          isOpen={openSection === "company"}
          onToggle={() => toggle("company")}
        >
          <CompanyForm embedded />
        </AccordionSection>

        <AccordionSection
          label="Add Location"
          isOpen={openSection === "location"}
          onToggle={() => toggle("location")}
        >
          <LocationForm embedded />
        </AccordionSection>

        {/* RoomForm handles two different operations, so we split it into two
            separate accordion sections using the `section` prop.
            section="add"    → renders only the "create a room" form
            section="assign" → renders only the "assign a batch to a room" form */}
        <AccordionSection
          label="Add Room"
          isOpen={openSection === "room"}
          onToggle={() => toggle("room")}
        >
          <RoomForm embedded section="add" />
        </AccordionSection>

        <AccordionSection
          label="Assign Batch to Room"
          isOpen={openSection === "assign"}
          onToggle={() => toggle("assign")}
        >
          <RoomForm embedded section="assign" />
        </AccordionSection>
      </div>
    </div>
  );
}
