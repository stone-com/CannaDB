// Taskbar — a fixed strip at the bottom of the screen that shows tabs for
// every window that is currently minimized, just like the Windows taskbar.
//
// Props:
//   tabs  – array of tab objects:
//             { key, label, visible, onClick }
//             key     – unique identifier (used as React list key)
//             label   – text shown on the tab
//             visible – boolean; tab only renders when true
//             onClick – function to call when the tab is clicked (restores window)
//
// The component renders nothing at all when zero tabs are visible, so it
// won't take up any space or paint a bar when all windows are open.
export default function Taskbar({ tabs }) {
  // Filter down to only the tabs that should actually be shown right now.
  const visibleTabs = tabs.filter((tab) => tab.visible);

  // If nothing is minimized, render nothing — no empty bar at the bottom.
  if (visibleTabs.length === 0) return null;

  return (
    <div className="taskbar">
      {visibleTabs.map((tab) => (
        <button
          key={tab.key}
          className="taskbar-tab"
          onClick={tab.onClick}
          title={`Restore ${tab.label}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
