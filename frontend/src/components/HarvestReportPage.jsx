/**
 * HarvestReportPage — browse harvest runs and drill into room/strain weights.
 * Layout: scrollable harvest list on the left, full breakdown on the right.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import GrassIcon from "@mui/icons-material/Grass";
import ScaleIcon from "@mui/icons-material/Scale";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import StatCard from "./ui/StatCard";
import MasterDetailShell from "./ui/MasterDetailShell";
import AnalyticsDataGrid from "./ui/AnalyticsDataGrid";
import { formatDate } from "../utils/formatDate";
import {
  buildHarvestListLabel,
  filterHarvests,
  formatHarvestMetric,
  formatHarvestPercent,
  formatToteWeights,
  roundToTenth,
  sortHarvests,
} from "../utils/harvestReportHelpers";

function HarvestReportPage({ harvests }) {
  const [selectedHarvestId, setSelectedHarvestId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoomTab, setSelectedRoomTab] = useState(0);
  const [selectedStrainKey, setSelectedStrainKey] = useState(null);

  const sortedHarvests = useMemo(() => {
    if (!Array.isArray(harvests)) return [];
    return sortHarvests(harvests, "date-desc");
  }, [harvests]);

  const visibleHarvests = useMemo(
    () => filterHarvests(sortedHarvests, searchQuery, formatDate),
    [searchQuery, sortedHarvests],
  );

  useEffect(() => {
    if (selectedHarvestId) return;
    if (visibleHarvests[0]) {
      setSelectedHarvestId(visibleHarvests[0]._id);
    }
  }, [visibleHarvests, selectedHarvestId]);

  useEffect(() => {
    if (!selectedHarvestId) return;
    const stillVisible = visibleHarvests.some(
      (harvest) => harvest._id === selectedHarvestId,
    );
    if (!stillVisible && visibleHarvests[0]) {
      setSelectedHarvestId(visibleHarvests[0]._id);
    }
  }, [selectedHarvestId, visibleHarvests]);

  const selectedHarvest = useMemo(
    () => sortedHarvests.find((harvest) => harvest._id === selectedHarvestId) || null,
    [selectedHarvestId, sortedHarvests],
  );

  const roomSections = useMemo(() => {
    if (!selectedHarvest || !Array.isArray(selectedHarvest.rooms)) return [];

    return selectedHarvest.rooms.map((roomEntry, roomIndex) => {
      const roomId = roomEntry?.roomId;
      const strains = Array.isArray(roomEntry?.strains) ? roomEntry.strains : [];

      const strainRows = strains.map((strainEntry, strainIndex) => ({
        key: `${selectedHarvest._id}-${roomIndex}-${strainIndex}`,
        strainName: strainEntry?.strainId?.name || "—",
        plantCount: strainEntry?.plantCount ?? 0,
        totalWetWeightGrams: strainEntry?.totalWetWeightGrams ?? 0,
        totalDryWeightGrams: strainEntry?.totalDryWeightGrams ?? 0,
        wetPlantAvgWeightGrams: strainEntry?.wetPlantAvgWeightGrams ?? null,
        dryPlantAvgWeightGrams: strainEntry?.dryPlantAvgWeightGrams ?? null,
        percentChangeWetToDry: strainEntry?.percentChangeWetToDry ?? null,
        yieldGramsPerSquareFoot: strainEntry?.yieldGramsPerSquareFoot ?? null,
        totes: Array.isArray(strainEntry?.totes) ? strainEntry.totes : [],
      }));

      return {
        roomSectionKey: `${selectedHarvest._id}-room-${roomIndex}`,
        roomName: roomId?.name || "—",
        roomType: roomId?.type || "—",
        roomSqFoot: roomId?.sqFoot == null ? null : roundToTenth(roomId.sqFoot),
        strainRows,
        roomDryTotal: strainRows.reduce(
          (sum, row) => sum + (Number(row.totalDryWeightGrams) || 0),
          0,
        ),
      };
    });
  }, [selectedHarvest]);

  useEffect(() => {
    setSelectedRoomTab(0);
    setSelectedStrainKey(null);
  }, [selectedHarvestId]);

  const activeRoomSection = roomSections[selectedRoomTab] || null;

  const selectedStrainRow = useMemo(() => {
    if (!activeRoomSection || !selectedStrainKey) return null;
    return (
      activeRoomSection.strainRows.find((row) => row.key === selectedStrainKey) ||
      null
    );
  }, [activeRoomSection, selectedStrainKey]);

  const metricColumn = (field, headerName, flex = 1) => ({
    field,
    headerName,
    flex,
    minWidth: 120,
    type: "number",
    valueFormatter: (value) => formatHarvestMetric(value),
  });

  const strainGridColumns = [
    { field: "strainName", headerName: "Strain", flex: 1.2, minWidth: 140 },
    metricColumn("plantCount", "Plants", 0.7),
    metricColumn("totalWetWeightGrams", "Wet (g)", 0.9),
    metricColumn("totalDryWeightGrams", "Dry (g)", 0.9),
    metricColumn("dryPlantAvgWeightGrams", "Dry avg/plant", 1),
    metricColumn("yieldGramsPerSquareFoot", "Yield g/sq ft", 1),
  ];

  if (sortedHarvests.length === 0) {
    return <Alert severity="info">No harvest records yet.</Alert>;
  }

  const sidebarHeader = (
    <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
      <TextField
        size="small"
        fullWidth
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search harvests…"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        {visibleHarvests.length} of {sortedHarvests.length} harvests
      </Typography>
    </Box>
  );

  const sidebar = (
    <List dense disablePadding>
      {visibleHarvests.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No harvests match your search.
          </Typography>
        </Box>
      ) : (
        visibleHarvests.map((harvest) => {
          const isSelected = selectedHarvest?._id === harvest._id;

          return (
            <ListItemButton
              key={harvest._id}
              selected={isSelected}
              onClick={() => setSelectedHarvestId(harvest._id)}
              sx={{ alignItems: "flex-start", py: 1.25 }}
            >
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {buildHarvestListLabel(harvest, formatDate)}
                  </Typography>
                }
                secondary={
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${formatHarvestMetric(harvest.totalDryWeightGrams)} g dry`}
                    />
                    <Chip size="small" label={`${harvest.totalPlantCount ?? 0} plants`} />
                  </Stack>
                }
              />
            </ListItemButton>
          );
        })
      )}
    </List>
  );

  const detail = selectedHarvest ? (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        minHeight: { xs: 420, md: 0 },
      }}
    >
      <Box
        sx={(theme) => ({
          p: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.background.paper, 0.95)})`,
        })}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={(theme) => ({
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(theme.palette.primary.main, 0.14),
              color: "primary.main",
              flexShrink: 0,
            })}
          >
            <AssessmentIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
              {selectedHarvest.harvestNumber || "Harvest"}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                icon={<CalendarTodayIcon />}
                label={formatDate(selectedHarvest.harvestDate)}
                variant="outlined"
              />
              <Chip size="small" label={selectedHarvest.locationId?.nickname || "—"} />
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ p: 2, overflow: "auto", flex: 1, minHeight: 0 }}>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              label="Total plants"
              value={formatHarvestMetric(selectedHarvest.totalPlantCount)}
              icon={<GrassIcon fontSize="small" />}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              label="Total wet"
              value={`${formatHarvestMetric(selectedHarvest.totalWetWeightGrams)} g`}
              icon={<ScaleIcon fontSize="small" />}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              label="Total dry"
              value={`${formatHarvestMetric(selectedHarvest.totalDryWeightGrams)} g`}
              icon={<ScaleIcon fontSize="small" />}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard
              label="Yield / sq ft"
              value={formatHarvestMetric(selectedHarvest.totalYieldGramsPerSquareFoot)}
              icon={<WarehouseIcon fontSize="small" />}
            />
          </Grid>
        </Grid>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          Room breakdown
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Pick a room tab, then click a strain row for tote and average details.
        </Typography>

        {roomSections.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No room breakdown recorded for this harvest.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {roomSections.length > 1 ? (
              <Tabs
                value={selectedRoomTab}
                onChange={(_, value) => {
                  setSelectedRoomTab(value);
                  setSelectedStrainKey(null);
                }}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: 1, borderColor: "divider" }}
              >
                {roomSections.map((section, index) => (
                  <Tab
                    key={section.roomSectionKey}
                    value={index}
                    label={`${section.roomName} (${formatHarvestMetric(section.roomDryTotal)} g)`}
                  />
                ))}
              </Tabs>
            ) : null}

            {activeRoomSection ? (
              <>
                <Paper
                  variant="outlined"
                  sx={(theme) => ({
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.default, 0.45),
                  })}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MeetingRoomIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {activeRoomSection.roomName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {activeRoomSection.roomType}
                          {activeRoomSection.roomSqFoot !== null
                            ? ` · ${formatHarvestMetric(activeRoomSection.roomSqFoot)} sq ft`
                            : ""}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      size="small"
                      color="secondary"
                      label={`${formatHarvestMetric(activeRoomSection.roomDryTotal)} g dry · ${activeRoomSection.strainRows.length} strains`}
                    />
                  </Stack>
                </Paper>

                <AnalyticsDataGrid
                  height={Math.min(
                    360,
                    Math.max(220, activeRoomSection.strainRows.length * 52 + 56),
                  )}
                  hideFooter={activeRoomSection.strainRows.length <= 8}
                  rows={activeRoomSection.strainRows.map((row) => ({
                    ...row,
                    id: row.key,
                  }))}
                  columns={strainGridColumns}
                  onRowClick={(params) => setSelectedStrainKey(String(params.id))}
                  getRowClassName={(params) =>
                    params.id === selectedStrainKey ? "analytics-row-selected" : ""
                  }
                  gridSx={{
                    "& .analytics-row-selected": {
                      bgcolor: "action.selected",
                    },
                  }}
                />

                {selectedStrainRow ? (
                  <Paper
                    variant="outlined"
                    sx={(theme) => ({
                      p: 2,
                      borderRadius: 2,
                      borderColor: alpha(theme.palette.primary.main, 0.35),
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                    })}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
                      {selectedStrainRow.strainName}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Plants harvested
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatHarvestMetric(selectedStrainRow.plantCount)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Wet avg / plant
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatHarvestMetric(selectedStrainRow.wetPlantAvgWeightGrams)} g
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Dry avg / plant
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatHarvestMetric(selectedStrainRow.dryPlantAvgWeightGrams)} g
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Wet → dry change
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatHarvestPercent(selectedStrainRow.percentChangeWetToDry)}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Divider sx={{ my: 0.5 }} />
                        <Typography variant="caption" color="text.secondary">
                          Tote wet weights (g)
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatToteWeights(selectedStrainRow.totes)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Select a strain row above to view averages and tote breakdown.
                  </Typography>
                )}
              </>
            ) : null}
          </Stack>
        )}
      </Box>
    </Paper>
  ) : (
    <Alert severity="info" sx={{ borderRadius: 2 }}>
      Select a harvest from the list to view its report.
    </Alert>
  );

  return (
    <Stack spacing={2} sx={{ height: "100%", minHeight: 480 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Harvest Report
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse harvest runs on the left, then review weights by room and strain.
        </Typography>
      </Stack>

      <MasterDetailShell
        height={540}
        mobileSidebarHeight={300}
        sidebarHeader={sidebarHeader}
        sidebar={sidebar}
        detail={detail}
      />
    </Stack>
  );
}

export default HarvestReportPage;
