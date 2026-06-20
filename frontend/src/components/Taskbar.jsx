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

// Bottom app bar for page navigation and open panel chips.
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
