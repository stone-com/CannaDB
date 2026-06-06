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
import WarehouseIcon from "@mui/icons-material/Warehouse";
import GrassIcon from "@mui/icons-material/Grass";
import LayersIcon from "@mui/icons-material/Layers";
import ScienceIcon from "@mui/icons-material/Science";
import { DataGrid } from "@mui/x-data-grid";
import { BarChart } from "@mui/x-charts";
import { formatDate } from "../utils/formatDate";

// Show active batch and plant data for one room.
function RoomViewer({ rooms, roomAssignments }) {
  // Selected location.
  const [selectedLocationId, setSelectedLocationId] = useState("");
  // Selected room.
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const allRooms = useMemo(() => (Array.isArray(rooms) ? rooms : []), [rooms]);
  const assignments = useMemo(
    () => (Array.isArray(roomAssignments) ? roomAssignments : []),
    [roomAssignments],
  );

  const sortedLocations = useMemo(() => {
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
    filteredRooms.find((room) => String(room._id) === String(selectedRoomId)) ||
    null;

  const roomTotalPlants = useMemo(() => {
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
    {
      label: "Room",
      value: selectedRoom
        ? `${selectedRoom.name}${selectedRoom.type ? ` (${selectedRoom.type})` : ""}`
        : "N/A",
      icon: <WarehouseIcon fontSize="small" />,
      tone: "linear-gradient(135deg, rgba(9, 121, 105, 0.14), rgba(9, 121, 105, 0.03))",
    },
    {
      label: "Total Plants",
      value: roomTotalPlants.toLocaleString(),
      icon: <GrassIcon fontSize="small" />,
      tone: "linear-gradient(135deg, rgba(2, 136, 209, 0.16), rgba(2, 136, 209, 0.03))",
    },
    {
      label: "Active Batches",
      value: selectedRoomAssignments.length.toLocaleString(),
      icon: <LayersIcon fontSize="small" />,
      tone: "linear-gradient(135deg, rgba(245, 124, 0, 0.17), rgba(245, 124, 0, 0.03))",
    },
    {
      label: "Unique Strains",
      value: roomAnalytics.strainSeries.length.toLocaleString(),
      icon: <ScienceIcon fontSize="small" />,
      tone: "linear-gradient(135deg, rgba(123, 31, 162, 0.14), rgba(123, 31, 162, 0.03))",
    },
  ];

  return (
    <Stack spacing={2.25}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(244, 250, 248, 0.9))",
          backdropFilter: "blur(8px)",
        }}
      >
        <Stack spacing={1.25}>
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Room Viewer
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Active room composition, strain mix, and batch-level assignments.
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
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
              disabled={!selectedLocationId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              fullWidth
            >
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
          <Grid container spacing={1.5}>
            {summaryCards.map((card) => (
              <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    background: card.tone,
                    minHeight: 106,
                  }}
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
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.95)",
            }}
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
            const batch = assignment.batchId;
            const assignedPlants = Array.isArray(assignment?.assignedPlants)
              ? assignment.assignedPlants
              : [];
            const batchTotalPlants = assignedPlants.reduce(
              (sum, row) => sum + (Number(row.count) || 0),
              0,
            );

            return (
              <Card
                key={assignment._id}
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.95)",
                }}
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
                        ["Clone Date", formatDate(batch?.cloneDate)],
                        ["Harvest Date", formatDate(batch?.harvestDate)],
                        ["Batch Type", batch?.batchType || "production"],
                        ["Plants in Room", batchTotalPlants],
                      ].map(([label, value]) => (
                        <Grid
                          key={`${assignment._id}-${label}`}
                          size={{ xs: 12, md: 3 }}
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
                              {label}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 700 }}
                            >
                              {value}
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
                          sx={{
                            borderRadius: 1.5,
                            borderColor: "divider",
                            "& .MuiDataGrid-columnHeaders": {
                              backgroundColor: "rgba(25, 118, 210, 0.06)",
                              fontWeight: 700,
                            },
                          }}
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
