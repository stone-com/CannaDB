import { useState } from "react";
import CompanyForm from "./admin-forms/CompanyForm";
import LocationForm from "./admin-forms/LocationForm";
import RoomForm from "./admin-forms/RoomForm";
import StrainForm from "./admin-forms/StrainForm";

// Each card on the admin page is described by one object in this array.
// key        – a unique ID used to track which card is open
// label      – the big title shown on the card face
// description – the small subtitle shown below the label
const ADMIN_CARDS = [
  {
    key: "strain",
    label: "Add Strain",
    description: "Create a new strain record",
  },
  {
    key: "company",
    label: "Add Company",
    description: "Register a new company",
  },
  {
    key: "location",
    label: "Add Location",
    description: "Add a grow location",
  },
  { key: "room", label: "Add Room", description: "Create a new grow room" },
  {
    key: "assign",
    label: "Assign Batch to Room",
    description: "Move a batch into a room",
  },
];

export default function AdminPanel() {
  // activeCard holds the `key` of whichever card the user clicked.
  // null means no card is open — just the grid of cards is shown.
  const [activeCard, setActiveCard] = useState(null);

  // Opens a card. Clicking the same card again closes it.
  function handleCardClick(key) {
    setActiveCard((prev) => (prev === key ? null : key));
  }

  // Go back to the card grid.
  function handleBack() {
    setActiveCard(null);
  }

  // ── If a card is open, render the form panel ──────────────────────────────
  if (activeCard) {
    return (
      <div className="admin-panel">
        <button className="admin-back-button" onClick={handleBack}>
          ← Back
        </button>

        <div className="admin-form-panel">
          {activeCard === "strain" && <StrainForm embedded />}
          {activeCard === "company" && <CompanyForm embedded />}
          {activeCard === "location" && <LocationForm embedded />}

          {/* `embedded` tells RoomForm to skip rendering its own wrapper div and
               heading — AdminPanel is already providing the page container, so we
               don't want a second one nested inside it.
               Writing `embedded` with no value is shorthand for `embedded={true}`.

               `section` tells RoomForm which of its two sub-forms to show:
                 section="add"    → show only the "create a new room" form
                 section="assign" → show only the "assign a batch to a room" form
               RoomForm handles both operations, so the prop lets us pick one. */}
          {activeCard === "room" && <RoomForm embedded section="add" />}
          {activeCard === "assign" && <RoomForm embedded section="assign" />}
        </div>
      </div>
    );
  }

  // ── Default view: grid of cards ───────────────────────────────────────────
  return (
    <div className="admin-panel">
      <h1>Admin Controls</h1>
      <p className="admin-panel-subtitle">Click a card to open its form.</p>

      <div className="admin-cards">
        {ADMIN_CARDS.map((card) => (
          <button
            key={card.key}
            className="admin-card"
            onClick={() => handleCardClick(card.key)}
          >
            <span className="admin-card-label">{card.label}</span>
            <span className="admin-card-description">{card.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
