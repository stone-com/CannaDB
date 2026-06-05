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

const DATA_VIEWER_OPTIONS = [
  { key: "strains", label: "Strains" },
  { key: "harvestReport", label: "Harvest Report" },
  { key: "roomViewer", label: "Room Viewer" },
];

const HARVEST_OPTIONS = [
  { key: "harvestForm", label: "Add Harvest" },
  { key: "dryWeightForm", label: "Add Dry Weights" },
];

const DATA_REFRESH_EVENTS = [
  "company:created",
  "location:created",
  "room:created",
  "roomAssignment:created",
  "batch:created",
  "batch:updated",
  "strain:created",
];

function App() {
  const [strains, setStrains] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomAssignments, setRoomAssignments] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activePage, setActivePage] = useState("dashboard");

  const [selectedViews, setSelectedViews] = useState({
    strains: false,
    harvestReport: false,
    roomViewer: false,
    harvestForm: false,
    dryWeightForm: false,
  });

  const [minimizedWindows, setMinimizedWindows] = useState({
    strains: false,
    harvestReport: false,
    roomViewer: false,
    harvestForm: false,
    dryWeightForm: false,
  });

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

  const fetchAllData = useCallback(async () => {
    setLoadingData(true);
    await Promise.all([
      fetchCollection("/api/strains", setStrains),
      fetchCollection("/api/rooms", setRooms),
      fetchCollection("/api/room-assignments", setRoomAssignments),
      fetchCollection("/api/harvests", setHarvests),
    ]);
    setLoadingData(false);
  }, [fetchCollection]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    const handleDataCreated = () => fetchAllData();

    DATA_REFRESH_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleDataCreated);
    });

    return () => {
      DATA_REFRESH_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleDataCreated);
      });
    };
  }, [fetchAllData]);

  const toggleView = (key) => {
    setSelectedViews((prev) => ({ ...prev, [key]: !prev[key] }));
    setMinimizedWindows((prev) => ({ ...prev, [key]: false }));
  };

  const toggleMinimize = (key) => {
    setMinimizedWindows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-header-title">CannaDB</span>
      </header>

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
        {activePage === "dashboard" && (
          <div className="dashboard-page">
            {loadingData && <p>Loading data...</p>}
          </div>
        )}

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
              <StrainDataViewer
                strains={strains}
                roomAssignments={roomAssignments}
                harvests={harvests}
              />
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
              <RoomViewer rooms={rooms} roomAssignments={roomAssignments} />
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
