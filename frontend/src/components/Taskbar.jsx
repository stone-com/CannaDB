import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Chip,
  Stack,
  Toolbar,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

// Bottom app bar for page navigation and minimized/open panel shortcuts.
export default function Taskbar({ tabs, activePage, onNavigate }) {
  // Only show chips for panels currently available in the active page.
  const visibleTabs = tabs.filter((tab) => tab.visible);

  // Render bottom navigation buttons and open-window chips.
  return (
    <AppBar
      position="fixed"
      color="inherit"
      sx={{
        top: "auto",
        bottom: 0,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 2, minHeight: "64px !important" }}>
        {/* BottomNavigation handles page-level tab state (dashboard/admin). */}
        <BottomNavigation
          showLabels
          value={activePage}
          // BottomNavigation onChange provides the selected value as second arg.
          onChange={(_, value) => onNavigate(value)}
          sx={{ minWidth: 240, borderRadius: 3, overflow: "hidden" }}
        >
          <BottomNavigationAction
            label="Dashboard"
            value="dashboard"
            icon={<DashboardIcon />}
          />
          <BottomNavigationAction
            label="Admin"
            value="admin"
            icon={<AdminPanelSettingsIcon />}
          />
        </BottomNavigation>

        {/* Chip row mirrors currently open/minimized floating panels. */}
        <Box sx={{ flex: 1, overflowX: "auto", pb: 0.4 }}>
          <Stack direction="row" spacing={1}>
            {visibleTabs.map((tab) => (
              // One chip per open panel; style changes show minimized vs active.
              <Chip
                key={tab.key}
                clickable
                // Clicking chip toggles minimize/restore for that floating panel.
                onClick={tab.onClick}
                color={tab.minimized ? "default" : "primary"}
                variant={tab.minimized ? "outlined" : "filled"}
                label={tab.label}
              />
            ))}
          </Stack>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
