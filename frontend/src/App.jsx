// React hooks we use in this file:
//   useState    – stores values that can change over time (triggers re-render when updated)
//   useEffect   – runs code after the component renders (great for fetching data, subscriptions)
//   useCallback – wraps a function so React doesn't recreate it on every render
import { useCallback, useEffect, useState } from "react";
import "./App.css";
// These are the other components used in this file. React apps are built by
// composing small reusable pieces like these together.
import AdminPanel from "./components/AdminPanel";
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
  // useState([]) creates a state variable initialized to an empty array.
  // The two values you get back are: [currentValue, setterFunction]
  // Calling the setter (e.g. setStrains([...])) updates the value and re-renders the component.
  const [strains, setStrains] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [harvests, setHarvests] = useState([]);

  // loadingData starts as true so the UI can show a loading message.
  // Once all data fetches are done, we set it to false to reveal the content.
  const [loadingData, setLoadingData] = useState(true);

  // activePage controls which "page" is showing — either "dashboard" or "admin".
  // This is how we switch between pages without a router library.
  const [activePage, setActivePage] = useState("dashboard");

  // selectedViews is an object that tracks which floating windows are open.
  // { strains: true } means the Strains window is open.
  // { harvestReport: false } means the Harvest Report window is closed.
  // Using an object lets us manage all window visibility in one state variable.
  const [selectedViews, setSelectedViews] = useState({
    strains: true,
    harvestReport: false,
  });

  // Tracks which open windows are currently minimized to the taskbar.
  // When a key is true, that window's DraggableWindow renders null and a tab
  // appears in the taskbar at the bottom of the screen instead.
  const [minimizedWindows, setMinimizedWindows] = useState({
    strains: false,
    harvestReport: false,
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
    // Functional state update — pass a function instead of a value.
    // React gives you the current state as the argument (called `prev` here).
    // The spread syntax `...prev` copies all existing object keys into a new object.
    // Then [key]: !prev[key] does two things:
    //   [key]   – computed property name: uses the value of `key` as the property name
    //   !prev[key] – flips true to false (and false to true)
    setSelectedViews((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    // Also clear minimized state when closing a window entirely.
    // If you close a window that was minimized, it shouldn't show up again as minimized.
    setMinimizedWindows((prev) => ({ ...prev, [key]: false }));
  };

  // Sends a window to the taskbar (minimize) or restores it (if already minimized).
  const toggleMinimize = (key) => {
    setMinimizedWindows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-root">
      {/* Left sidebar — only visible on the dashboard page */}
      {activePage === "dashboard" && (
        <aside className="viewer-sidebar">
          <h2 className="viewer-sidebar-title">Data Viewer</h2>
          <p className="viewer-sidebar-hint">
            Open a panel as a floating window:
          </p>
          <div className="viewer-options">
            {VIEW_OPTIONS.map((option) => (
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
            <h1>Inventory Manager</h1>
            {/* loadingData && <p>...</p> shows the loading message until data arrives */}
            {loadingData && <p>Loading data...</p>}
          </div>
        )}

        {/* AdminPanel is only rendered when the user is on the admin page */}
        {activePage === "admin" && <AdminPanel />}
      </div>

      {/* Floating windows — only rendered on the dashboard page and after data has loaded.
           !loadingData means "loading is finished"
           Both conditions must be true for these windows to appear. */}
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
        ]}
      />
      <New />
    </div>
  );
}

export default App;
