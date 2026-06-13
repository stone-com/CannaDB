import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import InsightsIcon from "@mui/icons-material/Insights";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import SpaIcon from "@mui/icons-material/Spa";
import AssessmentIcon from "@mui/icons-material/Assessment";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import AgricultureIcon from "@mui/icons-material/Agriculture";
import ScaleIcon from "@mui/icons-material/Scale";
import LogoutIcon from "@mui/icons-material/Logout";
import HistoryIcon from "@mui/icons-material/History";
import AdminPanel from "./components/AdminPanel";
import AuditLogPage from "./components/AuditLogPage";
import HarvestForm from "./components/HarvestForm";
import DryWeightForm from "./components/DryWeightForm";
import HarvestReportPage from "./components/HarvestReportPage";
import StrainDataViewer from "./components/StrainDataViewer";
import RoomViewer from "./components/RoomViewer";
import DraggableWindow from "./components/DraggableWindow";
import PanelView from "./components/PanelView";
import Taskbar from "./components/Taskbar";
import UpcomingHarvestCard from "./components/UpcomingHarvestCard";
import RoomReportCard from "./components/RoomReportCard";

// Layout sizing constants for the app shell.
const APP_BAR_HEIGHT = 64;
const SIDEBAR_EXPANDED_WIDTH = 320;
const SIDEBAR_COLLAPSED_WIDTH = 88;

const DATA_VIEWER_OPTIONS = [
  { key: "strains", label: "Strains", icon: SpaIcon },
  { key: "harvestReport", label: "Harvest Report", icon: AssessmentIcon },
  { key: "roomViewer", label: "Room Viewer", icon: MeetingRoomIcon },
];

// Dashboard button definitions used to render sidebar launchers.
const HARVEST_OPTIONS = [
  { key: "harvestForm", label: "Add Harvest", icon: AgricultureIcon },
  { key: "dryWeightForm", label: "Add Dry Weights", icon: ScaleIcon },
];

const PANEL_KEYS = [
  "strains",
  "harvestReport",
  "roomViewer",
  "harvestForm",
  "dryWeightForm",
];

const DATA_REFRESH_EVENTS = [
  "company:created",
  "location:created",
  "location:updated",
  "room:created",
  "roomAssignment:created",
  "batch:created",
  "batch:updated",
  "strain:created",
];

// Main application shell and dashboard/workspace coordinator.
function App({ darkMode, onToggleDarkMode, onLogout }) {
  // Shared datasets used by dashboard cards and panels.
  const [strains, setStrains] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [roomAssignments, setRoomAssignments] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Boolean flags for whether each floating panel is currently open.
  const [selectedViews, setSelectedViews] = useState({
    strains: false,
    harvestReport: false,
    roomViewer: false,
    harvestForm: false,
    dryWeightForm: false,
  });

  // Tracks whether each floating panel is minimized to taskbar.
  const [minimizedWindows, setMinimizedWindows] = useState({
    strains: false,
    harvestReport: false,
    roomViewer: false,
    harvestForm: false,
    dryWeightForm: false,
  });

  // Tracks which panels are in full-screen mode.
  const [fullscreenWindows, setFullscreenWindows] = useState({
    strains: false,
    harvestReport: false,
    roomViewer: false,
    harvestForm: false,
    dryWeightForm: false,
  });

  // Which full-screen panel is currently visible (when several are maximized).
  const [activeFullscreenKey, setActiveFullscreenKey] = useState(null);

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Generic fetch helper for API collections.
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

  // Refresh all dashboard datasets together.
  const fetchAllData = useCallback(async () => {
    setLoadingData(true);
    await Promise.all([
      fetchCollection("/api/strains", setStrains),
      fetchCollection("/api/rooms", setRooms),
      fetchCollection("/api/batches", setBatches),
      fetchCollection("/api/room-assignments", setRoomAssignments),
      fetchCollection("/api/harvests", setHarvests),
    ]);
    setLoadingData(false);
  }, [fetchCollection]);

  // Initial data load.
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Keep data fresh when forms dispatch app-level events.
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

  // Toggle panel visibility and always un-minimize when opened.
  const toggleView = (key) => {
    setSelectedViews((prev) => {
      const opening = !prev[key];

      if (!opening) {
        setFullscreenWindows((fullscreen) => {
          const nextFullscreen = { ...fullscreen, [key]: false };
          setActiveFullscreenKey((current) => {
            if (current !== key) return current;
            return Object.keys(nextFullscreen).find((k) => nextFullscreen[k]) || null;
          });
          return nextFullscreen;
        });
      }

      return { ...prev, [key]: opening };
    });
    setMinimizedWindows((prev) => ({ ...prev, [key]: false }));
  };

  const openHarvestWindow = () => {
    setSelectedViews((prev) => ({ ...prev, harvestForm: true }));
    setMinimizedWindows((prev) => ({ ...prev, harvestForm: false }));
  };

  // Minimize or restore one floating window from the taskbar/chips.
  const toggleMinimize = (key) => {
    setMinimizedWindows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // One taskbar chip per open panel — show, hide, or switch full-screen panels.
  const handleTaskbarPanelClick = (key) => {
    if (!selectedViews[key]) return;

    setActivePage("dashboard");

    if (minimizedWindows[key]) {
      setMinimizedWindows((prev) => ({ ...prev, [key]: false }));
      if (fullscreenWindows[key]) {
        setActiveFullscreenKey(key);
      }
      return;
    }

    if (fullscreenWindows[key]) {
      if (activeFullscreenKey === key) {
        setMinimizedWindows((prev) => {
          const nextMinimized = { ...prev, [key]: true };
          setActiveFullscreenKey((current) => {
            if (current !== key) return current;
            return (
              PANEL_KEYS.find(
                (panelKey) =>
                  panelKey !== key &&
                  selectedViews[panelKey] &&
                  fullscreenWindows[panelKey] &&
                  !nextMinimized[panelKey],
              ) || null
            );
          });
          return nextMinimized;
        });
      } else {
        setActiveFullscreenKey(key);
      }
      return;
    }

    toggleMinimize(key);
  };

  // Expand a panel to full screen, or restore it to floating mode.
  const toggleFullscreen = (key) => {
    setFullscreenWindows((prev) => {
      const entering = !prev[key];
      const next = { ...prev, [key]: entering };

      if (entering) {
        setMinimizedWindows((minimized) => ({ ...minimized, [key]: false }));
        setActivePage("dashboard");
        setActiveFullscreenKey(key);
      } else {
        setActiveFullscreenKey((current) => {
          if (current !== key) return current;
          return Object.keys(next).find((k) => next[k]) || null;
        });
      }

      return next;
    });
  };

  // Dashboard KPI values.
  // Count how many panel toggles are currently switched on.
  const openWindowCount = Object.values(selectedViews).filter(Boolean).length;
  // Sum all currently assigned plants across active room assignments.
  const totalPlants = roomAssignments.reduce((sum, assignment) => {
    const plants = Array.isArray(assignment?.assignedPlants)
      ? assignment.assignedPlants
      : [];
    return (
      sum +
      plants.reduce((inner, plant) => inner + (Number(plant?.count) || 0), 0)
    );
  }, 0);

  // Sum dry grams from harvest records for top-level dashboard KPI.
  const totalDryWeight = harvests.reduce(
    (sum, harvest) => sum + (Number(harvest?.totalDryWeightGrams) || 0),
    0,
  );

  // Historical baseline used to estimate yields for upcoming harvests.
  const historicalAvgDryPerPlant = useMemo(() => {
    const totalHarvestPlants = harvests.reduce(
      (sum, harvest) => sum + (Number(harvest?.totalPlantCount) || 0),
      0,
    );

    if (totalHarvestPlants <= 0) return null;

    return totalDryWeight / totalHarvestPlants;
  }, [harvests, totalDryWeight]);

  // Next-harvest snapshot built from active room assignments.
  const upcomingHarvestDetails = useMemo(() => {
    // Step 1: collect unique active batches and sort by soonest harvest date.
    const candidates = roomAssignments
      .map((assignment) => assignment?.batchId)
      .filter(Boolean)
      .filter(
        (batch, index, arr) =>
          arr.findIndex(
            (candidate) => String(candidate?._id) === String(batch?._id),
          ) === index,
      )
      .filter((batch) => !batch?.harvestId)
      .map((batch) => ({
        batchNumber: batch?.batchNumber || "N/A",
        harvestDate: batch?.harvestDate ? new Date(batch.harvestDate) : null,
      }))
      .filter(
        (entry) =>
          entry.harvestDate && !Number.isNaN(entry.harvestDate.getTime()),
      )
      .sort((a, b) => a.harvestDate - b.harvestDate);

    // Step 2: pick nearest upcoming batch and summarize its rooms/strains/plants.
    const nextBatch = candidates[0];
    if (!nextBatch) return null;

    const assignmentsForBatch = roomAssignments.filter(
      (assignment) =>
        String(assignment?.batchId?._id) === String(nextBatch._id) &&
        assignment?.active !== false,
    );

    const roomNames = [
      ...new Set(
        assignmentsForBatch
          .map((assignment) => assignment?.roomId?.name)
          .filter(Boolean),
      ),
    ];

    const strainIds = new Set();
    const totalBatchPlants = assignmentsForBatch.reduce((sum, assignment) => {
      const assignedPlants = Array.isArray(assignment?.assignedPlants)
        ? assignment.assignedPlants
        : [];

      assignedPlants.forEach((plant) => {
        const strainId = String(plant?.strainId?._id || plant?.strainId || "");
        if (strainId) strainIds.add(strainId);
      });

      return (
        sum +
        assignedPlants.reduce(
          (inner, plant) => inner + (Number(plant?.count) || 0),
          0,
        )
      );
    }, 0);

    return {
      batchNumber: nextBatch.batchNumber || "N/A",
      harvestDate: nextBatch.harvestDate,
      rooms: roomNames,
      totalPlants: totalBatchPlants,
      totalStrains: strainIds.size,
      expectedYieldGrams:
        historicalAvgDryPerPlant === null
          ? null
          : Math.round(totalBatchPlants * historicalAvgDryPerPlant),
    };
  }, [historicalAvgDryPerPlant, roomAssignments]);

  const isPanelView =
    activePage === "dashboard" &&
    activeFullscreenKey &&
    selectedViews[activeFullscreenKey] &&
    fullscreenWindows[activeFullscreenKey] &&
    !minimizedWindows[activeFullscreenKey];

  const isPanelActiveInTaskbar = (key) => {
    if (minimizedWindows[key]) return false;
    if (fullscreenWindows[key]) return activeFullscreenKey === key;
    return !isPanelView;
  };

  const getPanelTitle = (key) => {
    if (key === "strains") return `Strains (${strains.length})`;
    if (key === "harvestReport") return "Harvest Report";
    if (key === "roomViewer") return "Room Viewer";
    if (key === "harvestForm") return "Add Harvest";
    if (key === "dryWeightForm") return "Add Dry Weights";
    return "Panel";
  };

  const renderWorkspacePanel = (key) => {
    if (key === "strains") {
      return (
        <StrainDataViewer
          strains={strains}
          roomAssignments={roomAssignments}
          harvests={harvests}
        />
      );
    }
    if (key === "harvestReport") {
      return <HarvestReportPage harvests={harvests} />;
    }
    if (key === "roomViewer") {
      return <RoomViewer rooms={rooms} roomAssignments={roomAssignments} />;
    }
    if (key === "harvestForm") {
      return (
        <HarvestForm
          onComplete={async () => {
            await fetchAllData();
            toggleView("harvestForm");
            setToast({
              open: true,
              message: "Harvest created successfully.",
              severity: "success",
            });
          }}
        />
      );
    }
    if (key === "dryWeightForm") {
      return (
        <DryWeightForm
          harvests={harvests}
          onComplete={async () => {
            await fetchAllData();
            toggleView("dryWeightForm");
            setToast({
              open: true,
              message: "Dry weights saved successfully.",
              severity: "success",
            });
          }}
        />
      );
    }
    return null;
  };

  const handleTaskbarNavigate = (page) => {
    setActivePage(page);
    if (page === "dashboard") {
      setActiveFullscreenKey(null);
    }
  };

  const buildTaskbarTab = (key, label) => ({
    key,
    label,
    visible: activePage === "dashboard" && selectedViews[key],
    active: isPanelActiveInTaskbar(key),
    onClick: () => handleTaskbarPanelClick(key),
  });

  // Sidebar width only on dashboard home — hidden for admin, activity log, and panel views.
  const dashboardSidebarWidth =
    activePage === "dashboard" && !isPanelView
      ? sidebarExpanded
        ? SIDEBAR_EXPANDED_WIDTH
        : SIDEBAR_COLLAPSED_WIDTH
      : 0;

  return (
    <Box sx={{ minHeight: "100vh", pb: 10 }}>
      {/* Fixed top app bar. Width shifts when dashboard sidebar is expanded/collapsed. */}
      <AppBar
        position="fixed"
        color="inherit"
        sx={(theme) => ({
          borderBottom: "1px solid",
          borderColor: "divider",
          ml: `${dashboardSidebarWidth}px`,
          width: `calc(100% - ${dashboardSidebarWidth}px)`,
          transition: theme.transitions.create(["margin-left", "width"], {
            duration: theme.transitions.duration.standard,
            easing: theme.transitions.easing.easeInOut,
          }),
        })}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <InsightsIcon color="primary" />
            <Typography variant="h6">CannaDB Operations Hub</Typography>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Open Panels: {openWindowCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Plants: {totalPlants.toLocaleString()}
            </Typography>
            {/* Theme toggle switches the entire app between light and dark modes. */}
            <IconButton
              size="small"
              onClick={onToggleDarkMode}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
            <Button
              size="small"
              variant={activePage === "auditLogs" ? "contained" : "outlined"}
              startIcon={<HistoryIcon />}
              onClick={() =>
                setActivePage((page) =>
                  page === "auditLogs" ? "dashboard" : "auditLogs",
                )
              }
            >
              Activity
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={onLogout}
            >
              Log out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Toolbar spacer keeps page content from sliding underneath the fixed AppBar. */}
      <Toolbar />

      <Box
        sx={{ display: "flex", minHeight: `calc(100vh - ${APP_BAR_HEIGHT}px)` }}
      >
        {activePage === "dashboard" && !isPanelView && (
          /* Permanent MUI Drawer used as the dashboard launcher rail. */
          <Drawer
            variant="permanent"
            sx={(theme) => ({
              width: dashboardSidebarWidth,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: dashboardSidebarWidth,
                boxSizing: "border-box",
                top: 0,
                height: "calc(100% - 64px)",
                borderRight: "1px solid",
                borderColor: "divider",
                background:
                  theme.palette.mode === "dark"
                    ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.16)}, ${alpha(theme.palette.background.paper, 0.97)})`
                    : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.background.paper, 0.95)})`,
                overflowX: "hidden",
                transition: theme.transitions.create("width", {
                  duration: theme.transitions.duration.standard,
                  easing: theme.transitions.easing.easeInOut,
                }),
              },
              transition: theme.transitions.create("width", {
                duration: theme.transitions.duration.standard,
                easing: theme.transitions.easing.easeInOut,
              }),
            })}
          >
            <Box sx={{ p: sidebarExpanded ? 2 : 1.25 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: sidebarExpanded ? "flex-end" : "center",
                  mb: 0.5,
                }}
              >
                <IconButton
                  size="small"
                  color="inherit"
                  onClick={() => setSidebarExpanded((prev) => !prev)}
                  aria-label={
                    sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"
                  }
                >
                  {sidebarExpanded ? <MenuOpenIcon /> : <MenuIcon />}
                </IconButton>
              </Box>

              <Typography
                variant="h6"
                sx={{
                  mb: sidebarExpanded ? 1 : 0.5,
                  opacity: sidebarExpanded ? 1 : 0,
                  transition: "opacity 180ms ease-in-out",
                  whiteSpace: "nowrap",
                }}
              >
                Dashboard Panels
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: sidebarExpanded ? 2 : 0.75,
                  opacity: sidebarExpanded ? 1 : 0,
                  height: sidebarExpanded ? "auto" : 0,
                  overflow: "hidden",
                  transition: "opacity 180ms ease-in-out",
                }}
              >
                Launch viewers and workflows in floating workspace windows.
              </Typography>

              <Typography
                variant="subtitle2"
                sx={{
                  mb: 0.5,
                  opacity: sidebarExpanded ? 1 : 0,
                  transition: "opacity 180ms ease-in-out",
                  whiteSpace: "nowrap",
                }}
              >
                Data Viewer
              </Typography>
              <List dense>
                {/* Data viewer panel toggles. */}
                {DATA_VIEWER_OPTIONS.map((option) => (
                  <ListItem key={option.key} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      selected={selectedViews[option.key]}
                      onClick={() => toggleView(option.key)}
                      sx={{
                        minHeight: 44,
                        justifyContent: sidebarExpanded ? "initial" : "center",
                        px: sidebarExpanded ? 1.5 : 1,
                        borderRadius: 1.5,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: sidebarExpanded ? 36 : 0,
                          mr: sidebarExpanded ? 1 : 0,
                          justifyContent: "center",
                        }}
                      >
                        <option.icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={option.label}
                        primaryTypographyProps={{ variant: "body2" }}
                        sx={{
                          opacity: sidebarExpanded ? 1 : 0,
                          whiteSpace: "nowrap",
                          transition: "opacity 180ms ease-in-out",
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 1.5 }} />

              <Typography
                variant="subtitle2"
                sx={{
                  mb: 0.5,
                  opacity: sidebarExpanded ? 1 : 0,
                  transition: "opacity 180ms ease-in-out",
                  whiteSpace: "nowrap",
                }}
              >
                Harvest Workflows
              </Typography>
              <List dense>
                {/* Harvest workflow panel toggles. */}
                {HARVEST_OPTIONS.map((option) => (
                  <ListItem key={option.key} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      selected={selectedViews[option.key]}
                      onClick={() => toggleView(option.key)}
                      sx={{
                        minHeight: 44,
                        justifyContent: sidebarExpanded ? "initial" : "center",
                        px: sidebarExpanded ? 1.5 : 1,
                        borderRadius: 1.5,
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: sidebarExpanded ? 36 : 0,
                          mr: sidebarExpanded ? 1 : 0,
                          justifyContent: "center",
                        }}
                      >
                        <option.icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={option.label}
                        primaryTypographyProps={{ variant: "body2" }}
                        sx={{
                          opacity: sidebarExpanded ? 1 : 0,
                          whiteSpace: "nowrap",
                          transition: "opacity 180ms ease-in-out",
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Drawer>
        )}

        <Box
          sx={{
            flex: 1,
            p: 3,
          }}
        >
          {/* LinearProgress gives users immediate feedback during API refreshes. */}
          {loadingData && <LinearProgress />}

          {isPanelView && !loadingData && (
            <PanelView
              title={getPanelTitle(activeFullscreenKey)}
              onExitFullscreen={() => toggleFullscreen(activeFullscreenKey)}
              onClose={() => toggleView(activeFullscreenKey)}
            >
              {renderWorkspacePanel(activeFullscreenKey)}
            </PanelView>
          )}

          {activePage === "dashboard" && !isPanelView && (
            // Dashboard page body: upcoming harvest, KPIs, and workspace intro.
            <Stack spacing={2}>
              {/* Hero summary card with nearest upcoming harvest details. */}
              <Grid container spacing={2}>
                {/* KPI cards shown as a responsive 4-column grid on desktop. */}
                <Grid size={{ xs: 12, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Strains
                      </Typography>
                      <Typography variant="h4">{strains.length}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Rooms
                      </Typography>
                      <Typography variant="h4">{rooms.length}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Harvests
                      </Typography>
                      <Typography variant="h4">{harvests.length}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Dry Weight (g)
                      </Typography>
                      <Typography variant="h4">
                        {Math.round(totalDryWeight).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Card
                sx={{
                  background:
                    "linear-gradient(120deg, rgba(0,95,115,0.94), rgba(10,147,150,0.9))",
                  color: "#fff",
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <InsightsIcon />
                    <Typography variant="h5">Operations Workspace</Typography>
                  </Stack>
                  <Typography
                    variant="body1"
                    sx={{ maxWidth: 780, opacity: 0.95 }}
                  >
                    Open any panel from the left rail to run analytics, room
                    analysis, and harvest workflows in parallel draggable
                    windows.
                  </Typography>
                </CardContent>
              </Card>

              <UpcomingHarvestCard
                batches={batches}
                onStartHarvest={openHarvestWindow}
              />

              <RoomReportCard
                rooms={rooms}
                roomAssignments={roomAssignments}
                onClick={() => toggleView("roomViewer")}
              />
            </Stack>
          )}

          {/* Admin page body is delegated to AdminPanel component. */}
          {activePage === "admin" && <AdminPanel />}

          {activePage === "auditLogs" && <AuditLogPage />}
        </Box>
      </Box>

      {!loadingData && activePage === "dashboard" && !isPanelView && (
        <>
          {selectedViews.strains && !fullscreenWindows.strains && (
            // Floating analytics window for strain-level live and historical metrics.
            <DraggableWindow
              title={`Strains (${strains.length})`}
              onClose={() => toggleView("strains")}
              isMinimized={minimizedWindows.strains}
              onMinimize={() => toggleMinimize("strains")}
              onToggleFullscreen={() => toggleFullscreen("strains")}
              leftBound={dashboardSidebarWidth}
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
          {selectedViews.harvestReport && !fullscreenWindows.harvestReport && (
            // Floating report window for room/strain harvest breakdowns.
            <DraggableWindow
              title="Harvest Report"
              onClose={() => toggleView("harvestReport")}
              isMinimized={minimizedWindows.harvestReport}
              onMinimize={() => toggleMinimize("harvestReport")}
              onToggleFullscreen={() => toggleFullscreen("harvestReport")}
              leftBound={dashboardSidebarWidth}
              defaultX={630}
              defaultY={230}
              defaultW={800}
              defaultH={520}
            >
              <HarvestReportPage harvests={harvests} />
            </DraggableWindow>
          )}
          {selectedViews.roomViewer && !fullscreenWindows.roomViewer && (
            // Floating room-focused window for assignments and composition charts.
            <DraggableWindow
              title="Room Viewer"
              onClose={() => toggleView("roomViewer")}
              isMinimized={minimizedWindows.roomViewer}
              onMinimize={() => toggleMinimize("roomViewer")}
              onToggleFullscreen={() => toggleFullscreen("roomViewer")}
              leftBound={dashboardSidebarWidth}
              defaultX={480}
              defaultY={200}
              defaultW={700}
              defaultH={440}
            >
              <RoomViewer rooms={rooms} roomAssignments={roomAssignments} />
            </DraggableWindow>
          )}
          {selectedViews.harvestForm && !fullscreenWindows.harvestForm && (
            // Floating workflow window for entering wet harvest tote data.
            <DraggableWindow
              title="Add Harvest"
              onClose={() => toggleView("harvestForm")}
              isMinimized={minimizedWindows.harvestForm}
              onMinimize={() => toggleMinimize("harvestForm")}
              onToggleFullscreen={() => toggleFullscreen("harvestForm")}
              leftBound={dashboardSidebarWidth}
              defaultX={240}
              defaultY={100}
              defaultW={760}
              defaultH={500}
            >
              <HarvestForm
                onComplete={async () => {
                  await fetchAllData();
                  toggleView("harvestForm");
                  setToast({
                    open: true,
                    message: "Harvest created successfully.",
                    severity: "success",
                  });
                }}
              />
            </DraggableWindow>
          )}
          {selectedViews.dryWeightForm && !fullscreenWindows.dryWeightForm && (
            // Floating workflow window for entering/finalizing dry weights.
            <DraggableWindow
              title="Add Dry Weights"
              onClose={() => toggleView("dryWeightForm")}
              isMinimized={minimizedWindows.dryWeightForm}
              onMinimize={() => toggleMinimize("dryWeightForm")}
              onToggleFullscreen={() => toggleFullscreen("dryWeightForm")}
              leftBound={dashboardSidebarWidth}
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
                  setToast({
                    open: true,
                    message: "Dry weights saved successfully.",
                    severity: "success",
                  });
                }}
              />
            </DraggableWindow>
          )}
        </>
      )}

      <Taskbar
        activePage={activePage}
        onNavigate={handleTaskbarNavigate}
        tabs={[
          buildTaskbarTab("strains", `Strains (${strains.length})`),
          buildTaskbarTab("harvestReport", "Harvest Report"),
          buildTaskbarTab("roomViewer", "Room Viewer"),
          buildTaskbarTab("harvestForm", "Add Harvest"),
          buildTaskbarTab("dryWeightForm", "Add Dry Weights"),
        ]}
      />

      {/* Snackbar is a short-lived global feedback message container. */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
