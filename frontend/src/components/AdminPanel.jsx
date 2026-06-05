import { useState } from "react";
import CompanyForm from "./admin-forms/CompanyForm";
import LocationForm from "./admin-forms/LocationForm";
import RoomForm from "./admin-forms/RoomForm";
import StrainForm from "./admin-forms/StrainForm";
import CreateMomsForm from "./admin-forms/CreateMomsForm";

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
    description: "Assign rooms, split plants, and advance stage",
  },
  {
    key: "createMoms",
    label: "Create Moms",
    description: "Cut plants from production into a mom batch",
  },
];

export default function AdminPanel() {
  const [activeCard, setActiveCard] = useState(null);

  function handleCardClick(key) {
    setActiveCard((prev) => (prev === key ? null : key));
  }

  function handleBack() {
    setActiveCard(null);
  }

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
          {activeCard === "room" && <RoomForm embedded section="add" />}
          {activeCard === "assign" && <RoomForm embedded section="assign" />}
          {activeCard === "createMoms" && <CreateMomsForm embedded />}
        </div>
      </div>
    );
  }

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
