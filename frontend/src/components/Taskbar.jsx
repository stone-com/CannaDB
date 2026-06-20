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

// This bar sits at the bottom of the screen for main page navigation.
// It also shows chips for each open panel so users can switch between them.
export default function Taskbar({ tabs, activePage, onNavigate }) {
  const visibleTabs = tabs.filter((tab) => tab.visible);
  const navValue =
    activePage === "dashboard" || activePage === "admin" ? activePage : false;

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
        {/* Main navigation: Dashboard and Admin pages */}
        <BottomNavigation
          showLabels
          value={navValue}
          onChange={(_, value) => onNavigate(value)}
          sx={{ minWidth: 240, borderRadius: 3, overflow: "hidden", flexShrink: 0 }}
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

        {/* Open panel tabs shown as clickable chips */}
        <Box sx={{ flex: 1, overflowX: "auto", pb: 0.4, minWidth: 0 }}>
          <Stack direction="row" spacing={1}>
            {visibleTabs.map((tab) => (
              <Chip
                key={tab.key}
                clickable
                onClick={tab.onClick}
                color={tab.active ? "primary" : "default"}
                variant={tab.active ? "filled" : "outlined"}
                label={tab.label}
              />
            ))}
          </Stack>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
