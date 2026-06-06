import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
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

  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Select Location"
        value={selectedLocationId}
        onChange={handleLocationChange}
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
      >
        <MenuItem value="">Choose a room</MenuItem>
        {filteredRooms.map((room) => (
          <MenuItem key={room._id} value={room._id}>
            {room.name}
            {room.type ? ` (${room.type})` : ""}
          </MenuItem>
        ))}
      </TextField>

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
          <Grid container spacing={2}>
            {[
              [
                "Room",
                `${selectedRoom.name}${selectedRoom.type ? ` (${selectedRoom.type})` : ""}`,
              ],
              ["Total Plants", roomTotalPlants],
              ["Active Batches", selectedRoomAssignments.length],
              ["Unique Strains", roomAnalytics.strainSeries.length],
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 12, md: 3 }}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" variant="body2">
                      {label}
                    </Typography>
                    <Typography variant="h6">{value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, mb: 1 }}
                  >
                    Plants by Strain
                  </Typography>
                  {roomAnalytics.strainSeries.length === 0 ? (
                    <Alert severity="info">
                      No strain plant data available.
                    </Alert>
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
                </CardContent>
              </Card>
            </Grid>
          </Grid>

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
              <Card key={assignment._id} variant="outlined">
                <CardContent>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    {[
                      ["Batch", batch?.batchNumber || "N/A"],
                      ["Type", batch?.batchType || "production"],
                      ["Clone Date", formatDate(batch?.cloneDate)],
                      ["Plants", batchTotalPlants],
                    ].map(([label, value]) => (
                      <Grid
                        key={`${assignment._id}-${label}`}
                        size={{ xs: 6, md: 3 }}
                      >
                        <Typography color="text.secondary" variant="caption">
                          {label}
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 700 }}
                        >
                          {value}
                        </Typography>
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
                      />
                    </Box>
                  )}
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
