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
  Tooltip,
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
import GridDetailRail, {
  DetailChipList,
  DetailMetricGrid,
} from "./ui/GridDetailRail";
import { formatDate } from "../utils/formatDate";
import {
  buildHarvestListLabel,
  filterHarvests,
  formatHarvestMetric,
  formatHarvestPercent,
  roundToTenth,
  sortHarvests,
} from "../utils/harvestReportHelpers";

function HarvestReportPage({ harvests }) {
  const [selectedHarvestId, setSelectedHarvestId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoomTab, setSelectedRoomTab] = useState(0);
  const [selectedStrainKey, setSelectedStrainKey] = useState(null);
  const [harvestListExpanded, setHarvestListExpanded] = useState(true);

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

  const handleStrainRowClick = (rowId) => {
    const id = String(rowId);
    setSelectedStrainKey((current) => (current === id ? null : id));
  };

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

  const sidebarHeader = harvestListExpanded ? (
    <Box sx={{ px: 1.25, pb: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
      <TextField
        size="small"
        fullWidth
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search…"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
        {visibleHarvests.length} of {sortedHarvests.length}
      </Typography>
    </Box>
  ) : null;

  const sidebar = (
    <List dense disablePadding>
      {visibleHarvests.length === 0 ? (
        harvestListExpanded ? (
          <Box sx={{ p: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              No harvests match your search.
            </Typography>
          </Box>
        ) : null
      ) : (
        visibleHarvests.map((harvest) => {
          const isSelected = selectedHarvest?._id === harvest._id;
          const fullLabel = buildHarvestListLabel(harvest, formatDate);
          const shortLabel = (() => {
            const parsed = harvest.harvestDate ? new Date(harvest.harvestDate) : null;
            if (parsed && !Number.isNaN(parsed.getTime())) {
              return parsed.toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
              });
            }
            return harvest.harvestNumber?.slice(-4) || "—";
          })();

          if (!harvestListExpanded) {
            return (
              <Tooltip key={harvest._id} title={fullLabel} placement="right">
                <ListItemButton
                  selected={isSelected}
                  onClick={() => setSelectedHarvestId(harvest._id)}
                  sx={{
                    justifyContent: "center",
                    px: 0.75,
                    py: 1,
                    minHeight: 44,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: "0.68rem",
                      lineHeight: 1.1,
                      textAlign: "center",
                    }}
                  >
                    {shortLabel}
                  </Typography>
                </ListItemButton>
              </Tooltip>
            );
          }

          return (
            <ListItemButton
              key={harvest._id}
              selected={isSelected}
              onClick={() => setSelectedHarvestId(harvest._id)}
              sx={{ alignItems: "flex-start", py: 1, px: 1.25 }}
            >
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {formatDate(harvest.harvestDate)}
                  </Typography>
                }
                secondary={
                  <Stack spacing={0.35} sx={{ mt: 0.35, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {harvest.harvestNumber || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {harvest.locationId?.nickname || "—"}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ pt: 0.25 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${formatHarvestMetric(harvest.totalDryWeightGrams)}g`}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                      <Chip
                        size="small"
                        label={`${harvest.totalPlantCount ?? 0}`}
                        sx={{ height: 20, fontSize: "0.65rem" }}
                      />
                    </Stack>
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

      <Box
        sx={{
          p: 2,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Grid container spacing={1.5} sx={{ mb: 2, flexShrink: 0 }}>
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

        <Divider sx={{ mb: 2, flexShrink: 0 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, flexShrink: 0 }}>
          Room breakdown
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 1.5, flexShrink: 0 }}
        >
          Pick a room tab, then click a strain row to open the inspector beside the table.
        </Typography>

        {roomSections.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No room breakdown recorded for this harvest.
          </Alert>
        ) : (
          <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
            {roomSections.length > 1 ? (
              <Tabs
                value={selectedRoomTab}
                onChange={(_, value) => {
                  setSelectedRoomTab(value);
                  setSelectedStrainKey(null);
                }}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
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
                    flexShrink: 0,
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

                <Paper
                  variant="outlined"
                  sx={{
                    flex: 1,
                    minHeight: 160,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      flexShrink: 0,
                      bgcolor: "action.hover",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {selectedStrainRow
                        ? "Inspector open — click the row again or ✕ to close"
                        : "Click a strain row to inspect averages and tote weights"}
                    </Typography>
                  </Box>

                  <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <AnalyticsDataGrid
                        fill
                        hideFooter={activeRoomSection.strainRows.length <= 8}
                        rows={activeRoomSection.strainRows.map((row) => ({
                          ...row,
                          id: row.key,
                        }))}
                        columns={strainGridColumns}
                        onRowClick={(params) => handleStrainRowClick(params.id)}
                        getRowClassName={(params) =>
                          params.id === selectedStrainKey ? "analytics-row-selected" : ""
                        }
                        gridSx={{
                          border: "none",
                          borderRadius: 0,
                          "& .analytics-row-selected": {
                            bgcolor: "action.selected",
                          },
                        }}
                      />
                    </Box>

                    <GridDetailRail
                      open={Boolean(selectedStrainRow)}
                      title={selectedStrainRow?.strainName || "Strain"}
                      subtitle="Harvest breakdown"
                      onClose={() => setSelectedStrainKey(null)}
                    >
                      {selectedStrainRow ? (
                        <Stack spacing={2}>
                          <DetailMetricGrid
                            metrics={[
                              {
                                label: "Plants harvested",
                                value: formatHarvestMetric(selectedStrainRow.plantCount),
                              },
                              {
                                label: "Wet avg / plant",
                                value: `${formatHarvestMetric(selectedStrainRow.wetPlantAvgWeightGrams)} g`,
                              },
                              {
                                label: "Dry avg / plant",
                                value: `${formatHarvestMetric(selectedStrainRow.dryPlantAvgWeightGrams)} g`,
                              },
                              {
                                label: "Wet → dry change",
                                value: formatHarvestPercent(
                                  selectedStrainRow.percentChangeWetToDry,
                                ),
                              },
                              {
                                label: "Total wet",
                                value: `${formatHarvestMetric(selectedStrainRow.totalWetWeightGrams)} g`,
                              },
                              {
                                label: "Total dry",
                                value: `${formatHarvestMetric(selectedStrainRow.totalDryWeightGrams)} g`,
                              },
                              {
                                label: "Yield / sq ft",
                                value: formatHarvestMetric(
                                  selectedStrainRow.yieldGramsPerSquareFoot,
                                ),
                              },
                            ]}
                          />

                          <Divider />

                          <DetailChipList
                            label="Tote wet weights (g)"
                            values={(selectedStrainRow.totes || []).map(
                              (tote, index) =>
                                `#${index + 1} · ${formatHarvestMetric(tote?.wetWeight ?? 0)} g`,
                            )}
                          />
                        </Stack>
                      ) : null}
                    </GridDetailRail>
                  </Box>
                </Paper>
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
    <Stack
      spacing={2}
      sx={{
        height: "100%",
        minHeight: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack spacing={0.5} sx={{ flexShrink: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Harvest Report
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse harvest runs on the left, then review weights by room and strain.
        </Typography>
      </Stack>

      <MasterDetailShell
        sidebarCollapsible
        sidebarExpanded={harvestListExpanded}
        onSidebarExpandedChange={setHarvestListExpanded}
        sidebarExpandedWidth={248}
        sidebarCollapsedWidth={72}
        mobileSidebarHeight={280}
        sidebarHeader={sidebarHeader}
        sidebar={sidebar}
        detail={detail}
      />
    </Stack>
  );
}

export default HarvestReportPage;
