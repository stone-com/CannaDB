import { useCallback, useEffect, useState } from "react";
import "./App.css";
import CompanyForm from "./components/CompanyForm";
import LocationForm from "./components/LocationForm";
import RoomForm from "./components/RoomForm";
import HarvestForm from "./components/HarvestForm";
import HarvestReportPage from "./components/HarvestReportPage";
import StrainDataViewer from "./components/StrainDataViewer";
import DraggableWindow from "./components/DraggableWindow";
import Taskbar from "./components/Taskbar";

// In React, it's common to keep UI config in arrays/objects like this.
// We later map over VIEW_OPTIONS to render checkboxes instead of hard-coding each one.
// This array drives the checkbox menu on the right side.
// Each object has a unique `key` and a display label.
const VIEW_OPTIONS = [
  { key: "strains", label: "Strains" },
  { key: "harvestReport", label: "Harvest Report" },
];

function App() {
  // A React function component is just a JavaScript function that returns JSX.
  // Every time state changes, React re-runs this function and updates the DOM efficiently.

  // React state: each call creates [currentValue, setterFunction].
  // Example: strains = current value, setStrains = function to update it.
  const [strains, setStrains] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedViews, setSelectedViews] = useState({
    strains: true,
    harvestReport: false,
  });
  // This is Jake's comment part 3 third times the charm
  // Tracks which open windows are currently minimized to the taskbar.
  // When a key is true, that window's DraggableWindow renders null and a tab
  // appears in the taskbar at the bottom of the screen instead.
  const [minimizedWindows, setMinimizedWindows] = useState({
    strains: false,
    harvestReport: false,
  });
  // Local state object for the top "Add Strain" form.
  // This is a controlled form: input values always come from React state.
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    status: "",
  });

  // Generic fetch helper so we can reuse the same logic for multiple endpoints.
  // `setter` is a function (like setStrains) passed in as an argument.
  // useCallback memoizes the function reference so it doesn't get recreated every render.
  // This helps with hook dependencies (like useEffect) and avoids unnecessary reruns.
  const fetchCollection = useCallback(async (path, setter) => {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${path}`);
      }
      const data = await res.json();
      // Defensive coding: ensure we only store arrays in list state.
      setter(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Error fetching ${path}:`, err);
    }
  }, []);

  // Loads all datasets used in the data viewer.
  // Promise.all runs requests in parallel instead of one-by-one.
  const fetchAllData = useCallback(async () => {
    setLoadingData(true);
    await Promise.all([
      fetchCollection("/api/strains", setStrains),
      fetchCollection("/api/rooms", setRooms),
      fetchCollection("/api/harvests", setHarvests),
    ]);
    setLoadingData(false);
  }, [fetchCollection]);

  useEffect(() => {
    // useEffect runs after render.
    // This effect loads data when the component first mounts (and whenever fetchAllData reference changes).
    // Because fetchAllData is in the dependency array, this is safe + lint-friendly.
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    // This effect subscribes to browser-level custom events.
    // Child components dispatch these events after successful creates.
    // Event-driven refresh: forms dispatch custom events after successful creates.
    const handleDataCreated = () => {
      fetchAllData();
    };

    window.addEventListener("company:created", handleDataCreated);
    window.addEventListener("location:created", handleDataCreated);
    window.addEventListener("room:created", handleDataCreated);
    window.addEventListener("harvest:created", handleDataCreated);
    window.addEventListener("strain:created", handleDataCreated);

    // Always clean up listeners to avoid duplicate handlers on re-renders/unmount.
    return () => {
      window.removeEventListener("company:created", handleDataCreated);
      window.removeEventListener("location:created", handleDataCreated);
      window.removeEventListener("room:created", handleDataCreated);
      window.removeEventListener("harvest:created", handleDataCreated);
      window.removeEventListener("strain:created", handleDataCreated);
    };
  }, [fetchAllData]);

  const toggleView = (key) => {
    // Functional state update receives the previous state value.
    // `...prev` (spread syntax) copies the old object, then we overwrite one key.
    setSelectedViews((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    // Also clear any minimized state when closing a window entirely.
    setMinimizedWindows((prev) => ({ ...prev, [key]: false }));
  };

  // Sends a window to the taskbar (minimize) or restores it (if already minimized).
  const toggleMinimize = (key) => {
    setMinimizedWindows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    // preventDefault stops the browser from refreshing the page on form submit.
    e.preventDefault();

    try {
      const res = await fetch("/api/strains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // JSON.stringify converts a JS object into JSON text for the request body.
          name: formData.name,
          type: formData.type || null,
          status: formData.status || null,
        }),
      });

      if (res.ok) {
        // Reset form and refresh list so the new item is visible.
        const savedStrain = await res.json();
        // CustomEvent lets us broadcast "something changed" across sibling components.
        window.dispatchEvent(
          new CustomEvent("strain:created", {
            detail: savedStrain,
          }),
        );
        setFormData({ name: "", type: "", status: "" });
        fetchAllData();
      } else {
        const error = await res.json();
        alert("Error: " + error.error);
      }
    } catch (err) {
      alert("Error adding strain: " + err.message);
    }
  };

  return (
    // JSX looks like HTML, but this is still JavaScript under the hood.
    <div className="page-layout">
      <div className="left-column">
        <h1>Inventory Manager</h1>

        <div className="form-container">
          <h2>Add New Strain</h2>
          <form onSubmit={handleSubmit}>
            {/* Controlled input example: value + onChange are both wired to state. */}
            <div className="form-field">
              <label className="form-label">
                Name (required):
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    // `...formData` keeps all existing fields, then updates only `name`.
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
        </div>

        <CompanyForm />
        <LocationForm />
        <RoomForm />
        <HarvestForm />
      </div>

      <div className="right-column">
        <div className="form-container">
          <h2>Data Viewer</h2>
          <p>Check a panel to open it as a floating window:</p>
          <div className="viewer-options">
            {/* `map` turns data arrays into JSX lists. */}
            {VIEW_OPTIONS.map((option) => (
              // `key` helps React track each list item efficiently.
              <label key={option.key} className="viewer-option">
                <input
                  type="checkbox"
                  checked={selectedViews[option.key]}
                  onChange={() => toggleView(option.key)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        {loadingData && <p>Loading data...</p>}
      </div>

      {/* ── Floating data windows ── */}
      {!loadingData && (
        <>
          {selectedViews.strains && (
            <DraggableWindow
              title={`Strains (${strains.length})`}
              onClose={() => toggleView("strains")}
              isMinimized={minimizedWindows.strains}
              onMinimize={() => toggleMinimize("strains")}
              defaultX={480}
              defaultY={80}
              defaultW={1000}
              defaultH={520}
            >
              <StrainDataViewer strains={strains} rooms={rooms} />
            </DraggableWindow>
          )}

          {selectedViews.harvestReport && (
            <DraggableWindow
              title="Harvest Report"
              onClose={() => toggleView("harvestReport")}
              isMinimized={minimizedWindows.harvestReport}
              onMinimize={() => toggleMinimize("harvestReport")}
              defaultX={630}
              defaultY={230}
              defaultW={800}
              defaultH={520}
            >
              <HarvestReportPage harvests={harvests} />
            </DraggableWindow>
          )}
        </>
      )}

      {/* ── Taskbar — minimized windows appear here as tabs ────────────────────── */}
      {/* Each tab object has: key, label, visible (bool), and onClick.     */}
      {/* Taskbar renders nothing when all tabs are hidden.                  */}
      <Taskbar
        tabs={[
          {
            key: "strains",
            label: `Strains (${strains.length})`,
            visible: selectedViews.strains && minimizedWindows.strains,
            onClick: () => toggleMinimize("strains"),
          },
          {
            key: "harvestReport",
            label: "Harvest Report",
            visible:
              selectedViews.harvestReport && minimizedWindows.harvestReport,
            onClick: () => toggleMinimize("harvestReport"),
          },
        ]}
      />
    </div>
  );
}

export default App;
