/**
 * RoomViewer — detailed view for one room's batches, strains, and timeline.
 * Usually opened from RoomViewerPanel with initialRoomId set.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import GrassIcon from "@mui/icons-material/Grass";
import LayersIcon from "@mui/icons-material/Layers";
import ScienceIcon from "@mui/icons-material/Science";
import StatCard from "./ui/StatCard";
import StrainMixChart from "./ui/StrainMixChart";
import AnalyticsDataGrid from "./ui/AnalyticsDataGrid";
import { formatDate } from "../utils/formatDate";
import { stageColor } from "../utils/roomOverviewHelpers";

function toDaysDelta(fromValue, toValue) {
  const from = new Date(fromValue);
  const to = new Date(toValue);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

function RoomViewer({ rooms, roomAssignments, initialRoomId = null }) {
  const allRooms = useMemo(() => (Array.isArray(rooms) ? rooms : []), [rooms]);
  const assignments = useMemo(
    () => (Array.isArray(roomAssignments) ? roomAssignments : []),
    [roomAssignments],
  );

  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");

  useEffect(() => {
    if (!initialRoomId) return;
    const room = allRooms.find((entry) => String(entry._id) === String(initialRoomId));
    if (room) {
      setSelectedLocationId(room.locationId?._id || "");
      setSelectedRoomId(room._id);
    }
  }, [allRooms, initialRoomId]);

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

  const filteredRooms = useMemo(() => {
    if (!selectedLocationId) return [];
    return allRooms
      .filter((room) => String(room.locationId?._id) === String(selectedLocationId))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allRooms, selectedLocationId]);

  const selectedRoomAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment?.active !== false &&
          String(assignment?.roomId?._id) === String(selectedRoomId),
      ),
    [assignments, selectedRoomId],
  );

  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return (
      allRooms.find((room) => String(room._id) === String(selectedRoomId)) || null
    );
  }, [allRooms, selectedRoomId]);

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

  const strainBreakdown = useMemo(() => {
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

    return Array.from(strainTotals.entries())
      .map(([name, count]) => ({
        name,
        count,
        share: roomTotalPlants > 0 ? (count / roomTotalPlants) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [roomTotalPlants, selectedRoomAssignments]);

  const handleLocationChange = (event) => {
    setSelectedLocationId(event.target.value);
    setSelectedRoomId("");
  };

  return (
    <Stack spacing={2}>
      {/* Manual filters — only when not opened from overview */}
      {!initialRoomId ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Select a room
            </Typography>
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Location"
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
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Room"
                  value={selectedRoomId}
                  disabled={!selectedLocationId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
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
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      ) : null}

      {!selectedRoom ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Choose a room to view its current contents.
        </Alert>
      ) : null}

      {selectedRoom && selectedRoomAssignments.length === 0 ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <strong>{selectedRoom.name}</strong> has no active batch assigned.
        </Alert>
      ) : null}

      {selectedRoom && selectedRoomAssignments.length > 0 ? (
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Total plants"
                value={roomTotalPlants.toLocaleString()}
                icon={<GrassIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Active batches"
                value={selectedRoomAssignments.length}
                icon={<LayersIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Unique strains"
                value={strainBreakdown.length}
                icon={<ScienceIcon fontSize="small" />}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Room type"
                value={selectedRoom.type || "—"}
              />
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Strain composition
            </Typography>

            {strainBreakdown.length === 0 ? (
              <Alert severity="info">No strain data available.</Alert>
            ) : (
              <StrainMixChart strains={strainBreakdown} />
            )}
          </Paper>

          <Divider />

          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Batch assignments
          </Typography>

          {selectedRoomAssignments.map((assignment) => {
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
            const isMomRoom = String(selectedRoom?.type || "")
              .toLowerCase()
              .includes("mom");
            const isMomBatch = String(batch?.batchType || "")
              .toLowerCase()
              .includes("mom");
            const showHarvestInfo = !(isMomRoom || isMomBatch);

            return (
              <Paper key={assignment._id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 800 }}>
                        Batch {batch?.batchNumber || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {batchTotalPlants} plants in this room
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap">
                      <Chip
                        size="small"
                        label={batch?.batchType || "production"}
                        variant="outlined"
                      />
                      {batch?.lifecycleStage ? (
                        <Chip
                          size="small"
                          label={batch.lifecycleStage}
                          color={stageColor(batch.lifecycleStage)}
                        />
                      ) : null}
                    </Stack>
                  </Stack>

                  <Grid container spacing={1}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" color="text.secondary">
                        Clone date
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatDate(batch?.cloneDate) || "—"}
                      </Typography>
                    </Grid>
                    {showHarvestInfo ? (
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="caption" color="text.secondary">
                          Harvest date
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatDate(batch?.harvestDate) || "—"}
                        </Typography>
                        {daysUntilHarvest !== null ? (
                          <Typography variant="caption" color="text.secondary">
                            {daysUntilHarvest < 0
                              ? `${Math.abs(daysUntilHarvest)} days overdue`
                              : daysUntilHarvest === 0
                                ? "Harvest is today"
                                : `${daysUntilHarvest} days remaining`}
                          </Typography>
                        ) : null}
                      </Grid>
                    ) : null}
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" color="text.secondary">
                        Time in room
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {daysInRoom === null
                          ? "—"
                          : `${daysInRoom} day${daysInRoom === 1 ? "" : "s"}`}
                      </Typography>
                    </Grid>
                  </Grid>

                  {assignedPlants.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                      No plants recorded for this batch in this room.
                    </Alert>
                  ) : (
                    <AnalyticsDataGrid
                      height={Math.min(320, Math.max(180, assignedPlants.length * 52 + 56))}
                      hideFooter={assignedPlants.length <= 6}
                      initialPageSize={10}
                      rows={assignedPlants.map((row, index) => {
                        const count = Number(row.count) || 0;
                        const share =
                          roomTotalPlants > 0
                            ? (count / roomTotalPlants) * 100
                            : 0;

                        return {
                          id: `${assignment._id}-${index}`,
                          strainName: row.strainId?.name || "Unknown Strain",
                          type: row.strainId?.type || "—",
                          count,
                          share,
                        };
                      })}
                      columns={[
                        {
                          field: "strainName",
                          headerName: "Strain",
                          flex: 1.3,
                          minWidth: 150,
                        },
                        {
                          field: "type",
                          headerName: "Type",
                          flex: 0.8,
                          minWidth: 100,
                        },
                        {
                          field: "count",
                          headerName: "Plants",
                          type: "number",
                          flex: 0.7,
                          minWidth: 90,
                        },
                        {
                          field: "share",
                          headerName: "% of room",
                          flex: 0.8,
                          minWidth: 100,
                          valueFormatter: (value) => `${Number(value).toFixed(1)}%`,
                        },
                      ]}
                    />
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : null}
    </Stack>
  );
}

export default RoomViewer;
