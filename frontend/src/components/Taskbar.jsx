// Taskbar — persistent navigation bar fixed to the bottom of the screen.
// It also renders floating window tabs (like a mini Windows taskbar).
//
// Props this component receives:
//   activePage  – "dashboard" | "admin" — which page is currently showing
//   onNavigate  – a function to call when a nav button is clicked, e.g. onNavigate("admin")
//   tabs        – an array of window tab objects. Each tab looks like:
//                 { key, label, visible, minimized, onClick }
//                   key       – unique name for this tab (e.g. "strains")
//                   label     – text shown on the tab button
//                   visible   – whether to show this tab at all
//                   minimized – whether the window is currently minimized
//                   onClick   – function to call when this tab is clicked
export default function Taskbar({ tabs, activePage, onNavigate }) {
  // .filter() loops through the tabs array and keeps only the ones where
  // tab.visible is true. This gives us a new array with only the tabs we want to show.
  const visibleTabs = tabs.filter((tab) => tab.visible);

  return (
    // <> is a React "Fragment" — a wrapper that lets you return multiple
    // elements side by side without adding an extra DOM element like a <div>.
    // We need this because we're returning two sibling elements (tabs + taskbar).
    <>
      {/* Only render the tabs strip if there's at least one tab to show.
          visibleTabs.length > 0 evaluates to true/false.
          The && operator means: "if the left side is true, render the right side." */}
      {visibleTabs.length > 0 && (
        <div className="taskbar-tabs">
          {/* .map() loops through each visible tab and returns a button for it.
              The key prop is required by React when rendering lists — it helps
              React track which items changed during re-renders. */}
          {visibleTabs.map((tab) => (
            // Template literal builds the className dynamically.
            // Backtick strings can embed expressions using ${...}.
            // If minimized → "taskbar-tab taskbar-tab--minimized"
            // If open      → "taskbar-tab taskbar-tab--open"
            <button
              key={tab.key}
              className={`taskbar-tab${tab.minimized ? " taskbar-tab--minimized" : " taskbar-tab--open"}`}
              onClick={tab.onClick}
              // title is the tooltip text shown on hover
              title={
                tab.minimized ? `Restore ${tab.label}` : `Minimize ${tab.label}`
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* The main taskbar bar — always visible at the bottom of the screen */}
      <div className="taskbar">
        <div className="taskbar-nav">
          {/* Each nav button gets the "active" CSS class when its page is current.
              The ternary reads: "if activePage equals 'dashboard', add ' active', else add nothing" */}
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
