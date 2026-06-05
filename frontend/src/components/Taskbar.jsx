// Bottom bar with page navigation and minimized window tabs.
export default function Taskbar({ tabs, activePage, onNavigate }) {
  const visibleTabs = tabs.filter((tab) => tab.visible);

  return (
    <>
      {visibleTabs.length > 0 && (
        <div className="taskbar-tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={`taskbar-tab${tab.minimized ? " taskbar-tab--minimized" : " taskbar-tab--open"}`}
              onClick={tab.onClick}
              title={
                tab.minimized ? `Restore ${tab.label}` : `Minimize ${tab.label}`
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="taskbar">
        <div className="taskbar-nav">
          <button
            className={`taskbar-nav-btn${activePage === "dashboard" ? " active" : ""}`}
            onClick={() => onNavigate("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`taskbar-nav-btn${activePage === "admin" ? " active" : ""}`}
            onClick={() => onNavigate("admin")}
          >
            Admin
          </button>
        </div>
      </div>
    </>
  );
}
