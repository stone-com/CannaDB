import { useCallback, useEffect, useState } from "react";
import "./App.css";
import AdminPanel from "./components/AdminPanel";
import HarvestForm from "./components/HarvestForm";
import DryWeightForm from "./components/DryWeightForm";
import HarvestReportPage from "./components/HarvestReportPage";
import StrainDataViewer from "./components/StrainDataViewer";
import RoomViewer from "./components/RoomViewer";
import DraggableWindow from "./components/DraggableWindow";
import Taskbar from "./components/Taskbar";

// Sidebar panel options mapped to checkboxes.
const DATA_VIEWER_OPTIONS = [
  { key: "strains", label: "Strains" },
  { key: "harvestReport", label: "Harvest Report" },
  { key: "roomViewer", label: "Room Viewer" },
];

const HARVEST_OPTIONS = [
  { key: "harvestForm", label: "Add Harvest" },
  { key: "dryWeightForm", label: "Add Dry Weights" },
];

function App() {
  const [strains, setStrains] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activePage, setActivePage] = useState("dashboard");

  // Tracks which floating windows are open.
  const [selectedViews, setSelectedViews] = useState({
    strains: false,
    harvestReport: false,
    roomViewer: false,
    harvestForm: false,
    dryWeightForm: false,
  });

  // Tracks which open windows are minimized to the taskbar.
  const [minimizedWindows, setMinimizedWindows] = useState({
    strains: false,
    harvestReport: false,
    roomViewer: false,
    harvestForm: false,
    dryWeightForm: false,
  });

  // Fetches a JSON array from `path` and stores it via `setter`.
  const fetchCollection = useCallback(async (path, setter) => {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to fetch ${path}`);
      const data = await res.json();
      setter(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Error fetching ${path}:`, err);
    }
  }, []);

  // Fetches all data in parallel.
  const fetchAllData = useCallback(async () => {
    setLoadingData(true);
    await Promise.all([
      fetchCollection("/api/strains", setStrains),
      fetchCollection("/api/rooms", setRooms),
      fetchCollection("/api/batches", setBatches),
      fetchCollection("/api/harvests", setHarvests),
    ]);
    setLoadingData(false);
  }, [fetchCollection]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    // Re-fetches all data when any form dispatches a create/update event.
    const handleDataCreated = () => fetchAllData();

    window.addEventListener("company:created", handleDataCreated);
    window.addEventListener("location:created", handleDataCreated);
    window.addEventListener("room:created", handleDataCreated);
    window.addEventListener("strain:created", handleDataCreated);

    // Always clean up listeners to avoid duplicate handlers on re-renders/unmount.
    return () => {
      window.removeEventListener("company:created", handleDataCreated);
      window.removeEventListener("location:created", handleDataCreated);
      window.removeEventListener("room:created", handleDataCreated);
      window.removeEventListener("strain:created", handleDataCreated);
    };
  }, [fetchAllData]);

  // Toggles a window open/closed and clears its minimized state when closing.
  const toggleView = (key) => {
    setSelectedViews((prev) => ({ ...prev, [key]: !prev[key] }));
    setMinimizedWindows((prev) => ({ ...prev, [key]: false }));
  };

  // Toggles a window between minimized (taskbar) and restored.
  const toggleMinimize = (key) => {
    setMinimizedWindows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-header-title">CannaDB</span>
      </header>

      {/* Left sidebar — only visible on the dashboard page */}
      {activePage === "dashboard" && (
        <aside className="viewer-sidebar">
          <h2 className="viewer-sidebar-title">Panels</h2>
          <p className="viewer-sidebar-hint">
            Open a panel as a floating window:
          </p>
          <div className="viewer-sections">
            <section className="viewer-section">
              <h3 className="viewer-section-title">Data Viewer</h3>
              <div className="viewer-options">
                {DATA_VIEWER_OPTIONS.map((option) => (
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
            </section>

            <section className="viewer-section">
              <h3 className="viewer-section-title">Harvest</h3>
              <div className="viewer-options">
                {HARVEST_OPTIONS.map((option) => (
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
            </section>
          </div>
        </aside>
      )}

      <div
        className={`main-content${activePage === "dashboard" ? " with-sidebar" : ""}`}
      >
        {/* Conditional rendering with && — only show content when on the matching page.
           "activePage === 'dashboard'" evaluates to true or false.
           If true → the dashboard div renders. If false → nothing renders. */}
        {activePage === "dashboard" && (
          <div className="dashboard-page">
            loadingData && <p>...</p> shows the loading message until data
            arrives
            {loadingData && <p>Loading data...</p>}
          </div>
        )}

        {/* AdminPanel is only rendered when the user is on the admin page */}
        {activePage === "admin" && <AdminPanel />}
      </div>

      {!loadingData && activePage === "dashboard" && (
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
          {selectedViews.roomViewer && (
            <DraggableWindow
              title="Room Viewer"
              onClose={() => toggleView("roomViewer")}
              isMinimized={minimizedWindows.roomViewer}
              onMinimize={() => toggleMinimize("roomViewer")}
              defaultX={480}
              defaultY={200}
              defaultW={700}
              defaultH={440}
            >
              <RoomViewer rooms={rooms} batches={batches} />
            </DraggableWindow>
          )}
          {selectedViews.harvestForm && (
            <DraggableWindow
              title="Add Harvest"
              onClose={() => toggleView("harvestForm")}
              isMinimized={minimizedWindows.harvestForm}
              onMinimize={() => toggleMinimize("harvestForm")}
              defaultX={240}
              defaultY={100}
              defaultW={760}
              defaultH={500}
            >
              <HarvestForm
                onComplete={async () => {
                  await fetchAllData();
                  toggleView("harvestForm");
                  window.alert("Harvest created successfully.");
                }}
              />
            </DraggableWindow>
          )}
          {selectedViews.dryWeightForm && (
            <DraggableWindow
              title="Add Dry Weights"
              onClose={() => toggleView("dryWeightForm")}
              isMinimized={minimizedWindows.dryWeightForm}
              onMinimize={() => toggleMinimize("dryWeightForm")}
              defaultX={240}
              defaultY={140}
              defaultW={860}
              defaultH={520}
            >
              <DryWeightForm
                harvests={harvests}
                onComplete={async () => {
                  await fetchAllData();
                  toggleView("dryWeightForm");
                  window.alert("Dry weights saved successfully.");
                }}
              />
            </DraggableWindow>
          )}
        </>
      )}

      {/* Taskbar is always shown, regardless of page.
           We pass it the current page + a navigate function so it can switch pages.
           tabs is an array of objects built right here — each object describes one
           window tab including whether it's visible and whether it's minimized. */}
      <Taskbar
        activePage={activePage}
        onNavigate={setActivePage}
        tabs={[
          {
            key: "strains",
            label: `Strains (${strains.length})`,
            visible: activePage === "dashboard" && selectedViews.strains,
            minimized: minimizedWindows.strains,
            onClick: () => toggleMinimize("strains"),
          },
          {
            key: "harvestReport",
            label: "Harvest Report",
            visible: activePage === "dashboard" && selectedViews.harvestReport,
            minimized: minimizedWindows.harvestReport,
            onClick: () => toggleMinimize("harvestReport"),
          },
          {
            key: "roomViewer",
            label: "Room Viewer",
            visible: activePage === "dashboard" && selectedViews.roomViewer,
            minimized: minimizedWindows.roomViewer,
            onClick: () => toggleMinimize("roomViewer"),
          },
          {
            key: "harvestForm",
            label: "Add Harvest",
            visible: activePage === "dashboard" && selectedViews.harvestForm,
            minimized: minimizedWindows.harvestForm,
            onClick: () => toggleMinimize("harvestForm"),
          },
          {
            key: "dryWeightForm",
            label: "Add Dry Weights",
            visible: activePage === "dashboard" && selectedViews.dryWeightForm,
            minimized: minimizedWindows.dryWeightForm,
            onClick: () => toggleMinimize("dryWeightForm"),
          },
        ]}
      />
    </div>
  );
}

export default App;
