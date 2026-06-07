import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import GrassIcon from "@mui/icons-material/Grass";
import LayersIcon from "@mui/icons-material/Layers";
import ScienceIcon from "@mui/icons-material/Science";
import { DataGrid } from "@mui/x-data-grid";
import { BarChart } from "@mui/x-charts";
import { formatDate } from "../utils/formatDate";

function toDaysDelta(fromValue, toValue) {
  const from = new Date(fromValue);
  const to = new Date(toValue);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

// Room-level dashboard for active assignments and strain distribution.
// Show active batch and plant data for one room.
function RoomViewer({ rooms, roomAssignments }) {
  // Selected location.
  const [selectedLocationId, setSelectedLocationId] = useState("");
  // Selected room.
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const allRooms = useMemo(() => (Array.isArray(rooms) ? rooms : []), [rooms]);
  // Defensive conversion: always work with arrays, even if props are missing.
  const assignments = useMemo(
    () => (Array.isArray(roomAssignments) ? roomAssignments : []),
    [roomAssignments],
  );

  const sortedLocations = useMemo(() => {
    // Build unique location list from rooms so location dropdown has no duplicates.
    const locations = allRooms
      .map((room) => room?.locationId)
      .filter((location) => location?._id)
      .filter(
        (location, index, arr) =>
          arr.findIndex(
            (candidate) => String(candidate._id) === String(location._id),
          ) === index,
      );

    return locations.sort((a, b) =>
      (a?.nickname || "").localeCompare(b?.nickname || ""),
    );
  }, [allRooms]);

  // Rooms in selected location.
  const filteredRooms = useMemo(() => {
    if (!selectedLocationId) return [];
    return allRooms
      .filter(
        (room) => String(room.locationId?._id) === String(selectedLocationId),
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allRooms, selectedLocationId]);

  const handleLocationChange = (e) => {
    // Reset room when location changes so room dropdown cannot be out of sync.
    setSelectedLocationId(e.target.value);
    setSelectedRoomId("");
  };

  // Assignments for selected room.
  const selectedRoomAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          String(assignment?.roomId?._id) === String(selectedRoomId),
      ),
    [assignments, selectedRoomId],
  );

  const selectedRoom =
    // Find the selected room object from currently filtered room list.
    filteredRooms.find((room) => String(room._id) === String(selectedRoomId)) ||
    null;

  const roomTotalPlants = useMemo(() => {
    // Sum all assigned plant counts across active assignments in the selected room.
    return selectedRoomAssignments.reduce((sum, assignment) => {
      const assignedPlants = Array.isArray(assignment?.assignedPlants)
        ? assignment.assignedPlants
        : [];

      return (
        sum +
        assignedPlants.reduce(
          (innerSum, plant) => innerSum + (Number(plant?.count) || 0),
          0,
        )
      );
    }, 0);
  }, [selectedRoomAssignments]);

  // Build chart-ready totals by strain for the selected room.
  const roomAnalytics = useMemo(() => {
    const strainTotals = new Map();

    selectedRoomAssignments.forEach((assignment) => {
      const assignedPlants = Array.isArray(assignment?.assignedPlants)
        ? assignment.assignedPlants
        : [];

      assignedPlants.forEach((plant) => {
        const strainName = plant?.strainId?.name || "Unknown Strain";
        strainTotals.set(
          strainName,
          (strainTotals.get(strainName) || 0) + (Number(plant?.count) || 0),
        );
      });
    });

    const strainSeries = Array.from(strainTotals.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const strainLabels = strainSeries.map((item) => item.label);
    const strainChartSeries = strainSeries.map((item, seriesIndex) => ({
      id: `strain-${seriesIndex}`,
      label: item.label,
      stack: "total",
      data: strainLabels.map((_, labelIndex) =>
        labelIndex === seriesIndex ? item.value : 0,
      ),
    }));

    const chartHeight = Math.min(
      840,
      Math.max(300, strainSeries.length * 42 + 50),
    );

    return {
      strainSeries,
      strainLabels,
      strainChartSeries,
      chartHeight,
    };
  }, [selectedRoomAssignments]);

  const summaryCards = [
    // Small card metadata array keeps JSX cleaner and easier to reorder.
    {
      label: "Room",
      value: selectedRoom
        ? `${selectedRoom.name}${selectedRoom.type ? ` (${selectedRoom.type})` : ""}`
        : "N/A",
      icon: <WarehouseIcon fontSize="small" />,
      tone: "primary",
    },
    {
      label: "Total Plants",
      value: roomTotalPlants.toLocaleString(),
      icon: <GrassIcon fontSize="small" />,
      tone: "info",
    },
    {
      label: "Active Batches",
      value: selectedRoomAssignments.length.toLocaleString(),
      icon: <LayersIcon fontSize="small" />,
      tone: "warning",
    },
    {
      label: "Unique Strains",
      value: roomAnalytics.strainSeries.length.toLocaleString(),
      icon: <ScienceIcon fontSize="small" />,
      tone: "secondary",
    },
  ];

  return (
    <Stack spacing={2.25}>
      {/* Filter header: pick location first, then room. */}
      <Paper
        elevation={0}
        sx={(theme) => ({
          p: { xs: 2, md: 2.5 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)}, ${alpha(theme.palette.background.paper, 0.92)})`
              : `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.96)}, ${alpha(theme.palette.primary.main, 0.06)})`,
          backdropFilter: "blur(8px)",
        })}
      >
        <Stack spacing={1.25}>
          {/* Header text explains this panel's purpose. */}
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Room Viewer
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Active room composition, strain mix, and batch-level assignments.
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            {/* First dropdown narrows available room options by location. */}
            <TextField
              select
              label="Select Location"
              value={selectedLocationId}
              onChange={handleLocationChange}
              fullWidth
            >
              <MenuItem value="">Choose a location</MenuItem>
              {sortedLocations.map((location) => (
                <MenuItem key={location._id} value={location._id}>
                  {location.nickname || "Unnamed Location"}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Select Room"
              value={selectedRoomId}
              // Room select stays disabled until a location is chosen.
              disabled={!selectedLocationId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              fullWidth
            >
              {/* Second dropdown is dependent on selected location. */}
              <MenuItem value="">Choose a room</MenuItem>
              {filteredRooms.map((room) => (
                <MenuItem key={room._id} value={room._id}>
                  {room.name}
                  {room.type ? ` (${room.type})` : ""}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </Paper>

      {!selectedRoom && (
        // Lightweight status messaging with MUI Alert components.
        <Alert severity="info">
          Choose a room above to view its current contents.
        </Alert>
      )}

      {selectedRoom && selectedRoomAssignments.length === 0 && (
        <Alert severity="warning">
          <strong>{selectedRoom.name}</strong> has no active batch assigned.
        </Alert>
      )}

      {selectedRoom && selectedRoomAssignments.length > 0 && (
        <Stack spacing={2}>
          {/* Responsive KPI cards for quick room-level stats. */}
          <Grid container spacing={1.5}>
            {summaryCards.map((card) => (
              // KPI cards are rendered from a shared metadata array.
              <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card
                  elevation={0}
                  sx={(theme) => ({
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    background:
                      card.tone === "primary"
                        ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)}, ${alpha(theme.palette.primary.main, 0.04)})`
                        : card.tone === "info"
                          ? `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.16)}, ${alpha(theme.palette.info.main, 0.04)})`
                          : card.tone === "warning"
                            ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.18)}, ${alpha(theme.palette.warning.main, 0.04)})`
                            : `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.16)}, ${alpha(theme.palette.secondary.main, 0.04)})`,
                    minHeight: 106,
                  })}
                >
                  <CardContent>
                    <Stack spacing={0.5}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            color: "text.secondary",
                            display: "inline-flex",
                          }}
                        >
                          {card.icon}
                        </Box>
                        <Typography color="text.secondary" variant="body2">
                          {card.label}
                        </Typography>
                      </Stack>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {card.value}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card
            elevation={0}
            sx={(theme) => ({
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.background.paper, 0.95),
            })}
          >
            <CardContent>
              <Stack spacing={1.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Plants by Strain
                </Typography>
                {roomAnalytics.strainSeries.length === 0 ? (
                  <Alert severity="info">No strain plant data available.</Alert>
                ) : (
                  <Box
                    sx={{ width: "100%", height: roomAnalytics.chartHeight }}
                  >
                    {/* MUI X BarChart renders strain composition for the selected room. */}
                    <BarChart
                      yAxis={[
                        {
                          scaleType: "band",
                          data: roomAnalytics.strainLabels,
                        },
                      ]}
                      xAxis={[{ label: "Plant Count" }]}
                      series={roomAnalytics.strainChartSeries}
                      slotProps={{ tooltip: { trigger: "item" } }}
                      hideLegend
                      layout="horizontal"
                      margin={{ left: 120, right: 20, top: 16, bottom: 30 }}
                    />
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          {selectedRoomAssignments.map((assignment) => {
            // One card per assignment to show batch details and per-strain breakdown.
            const batch = assignment.batchId;
            const assignedPlants = Array.isArray(assignment?.assignedPlants)
              ? assignment.assignedPlants
              : [];
            const batchTotalPlants = assignedPlants.reduce(
              (sum, row) => sum + (Number(row.count) || 0),
              0,
            );
            const daysInRoom = assignment?.startedAt
              ? toDaysDelta(assignment.startedAt, new Date())
              : null;
            const daysUntilHarvest = batch?.harvestDate
              ? toDaysDelta(new Date(), batch.harvestDate)
              : null;

            return (
              <Card
                key={assignment._id}
                elevation={0}
                sx={(theme) => ({
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                })}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        Batch {batch?.batchNumber || "N/A"}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip
                          size="small"
                          label={batch?.batchType || "production"}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`Plants: ${batchTotalPlants}`}
                          color="success"
                          variant="outlined"
                        />
                      </Stack>
                    </Stack>

                    <Grid container spacing={1.25}>
                      {[
                        {
                          label: "Clone Date",
                          value: formatDate(batch?.cloneDate),
                          detail: "Batch origin date",
                        },
                        {
                          label: "Harvest Date",
                          value: formatDate(batch?.harvestDate),
                          detail:
                            daysUntilHarvest === null
                              ? "No harvest date set"
                              : daysUntilHarvest < 0
                                ? `${Math.abs(daysUntilHarvest)} days overdue`
                                : daysUntilHarvest === 0
                                  ? "Harvest is today"
                                  : `${daysUntilHarvest} days until harvest`,
                        },
                        {
                          label: "Time in Room",
                          value:
                            daysInRoom === null
                              ? "N/A"
                              : `${daysInRoom} day${daysInRoom === 1 ? "" : "s"}`,
                          detail: batch?.lifecycleStage
                            ? `Current stage: ${batch.lifecycleStage}`
                            : "Current assignment duration",
                        },
                      ].map((meta) => (
                        // Render one metadata tile for each batch detail field.
                        <Grid
                          key={`${assignment._id}-${meta.label}`}
                          size={{ xs: 12, md: 4 }}
                        >
                          <Stack
                            spacing={0.25}
                            sx={{
                              p: 1,
                              borderRadius: 1.25,
                              border: "1px solid",
                              borderColor: "divider",
                              backgroundColor: "background.paper",
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {meta.label}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700 }}
                            >
                              {meta.value}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {meta.detail}
                            </Typography>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>

                    {assignedPlants.length === 0 ? (
                      <Alert severity="info">
                        No plants recorded for this batch in the selected room.
                      </Alert>
                    ) : (
                      <Box sx={{ height: 280 }}>
                        <DataGrid
                          // DataGrid is used for dense tabular strain data with consistent styling.
                          rows={assignedPlants.map((row, i) => ({
                            id: `${assignment._id}-${i}`,
                            strainName: row.strainId?.name || "Unknown Strain",
                            type: row.strainId?.type || "N/A",
                            count: row.count,
                            share:
                              roomTotalPlants > 0
                                ? `${((Number(row.count) / roomTotalPlants) * 100).toFixed(1)}%`
                                : "N/A",
                          }))}
                          columns={[
                            {
                              field: "strainName",
                              headerName: "Strain",
                              flex: 1.2,
                              minWidth: 150,
                            },
                            {
                              field: "type",
                              headerName: "Type",
                              flex: 0.8,
                              minWidth: 120,
                            },
                            {
                              field: "count",
                              headerName: "Plant Count",
                              type: "number",
                              flex: 0.7,
                              minWidth: 120,
                            },
                            {
                              field: "share",
                              headerName: "% of Room",
                              flex: 0.8,
                              minWidth: 120,
                            },
                          ]}
                          hideFooter
                          disableRowSelectionOnClick
                          sx={(theme) => ({
                            borderRadius: 1.5,
                            borderColor: "divider",
                            backgroundColor: alpha(
                              theme.palette.background.paper,
                              0.86,
                            ),
                            "& .MuiDataGrid-columnHeaders": {
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.14,
                              ),
                              fontWeight: 700,
                            },
                          })}
                        />
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default RoomViewer;
