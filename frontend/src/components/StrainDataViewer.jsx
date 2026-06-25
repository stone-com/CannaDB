/**
 * StrainDataViewer — browse strains, placements, harvest dates, and expected yield.
 * Layout: searchable list on the left, detail panel on the right.
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
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import SpaIcon from "@mui/icons-material/Spa";
import StatCard from "./ui/StatCard";
import MasterDetailShell from "./ui/MasterDetailShell";
import AnalyticsDataGrid from "./ui/AnalyticsDataGrid";
import { formatDate } from "../utils/formatDate";
import {
  formatAvgGrams,
  formatGrams,
  getExpectedYieldGrams,
  getNextHarvestExpectedYieldGrams,
  resolveAvgDryPerPlant,
} from "../utils/strainViewerHelpers";

function StrainDataViewer({ strains, roomAssignments, harvests }) {
  const [selectedStrainId, setSelectedStrainId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const strainSummaries = useMemo(() => {
    if (!Array.isArray(strains)) return [];

    const strainById = new Map(strains.map((strain) => [String(strain._id), strain]));
    const rowMap = new Map();

    strains.forEach((strain) => {
      rowMap.set(String(strain._id), {
        strainId: String(strain._id),
        strain: strainById.get(String(strain._id)),
        name: strain.name || "Unknown",
        type: strain.type || "—",
        status: strain.status || "—",
        totalPlants: 0,
        totalWetWeightGrams: 0,
        totalDryWeightGrams: 0,
        totalHarvestPlantCount: 0,
        nextHarvestDate: null,
        plantsByRoom: [],
      });
    });

    if (Array.isArray(roomAssignments)) {
      roomAssignments.forEach((assignment) => {
        if (assignment?.active === false) return;

        const room = assignment?.roomId;
        const batch = assignment?.batchId;
        const assignedPlants = Array.isArray(assignment?.assignedPlants)
          ? assignment.assignedPlants
          : [];

        if (!room || !batch || assignedPlants.length === 0) return;

        assignedPlants.forEach((plantEntry) => {
          const strainId = String(
            plantEntry?.strainId?._id || plantEntry?.strainId || "",
          );
          if (!strainId || !rowMap.has(strainId)) return;

          const row = rowMap.get(strainId);
          const plantCount = Number(plantEntry?.count) || 0;
          const batchType = batch?.batchType || "production";

          row.totalPlants += plantCount;
          row.plantsByRoom.push({
            roomName: room?.name || "—",
            locationName: room?.locationId?.nickname || "—",
            plantCount,
            batchNumber: batch?.batchNumber || "—",
            batchType,
            batchHarvestDate: batch?.harvestDate || null,
            lifecycleStage: batch?.lifecycleStage || "—",
          });

          const harvestDateValue = batch?.harvestDate
            ? new Date(batch.harvestDate)
            : null;

          if (harvestDateValue && !Number.isNaN(harvestDateValue.getTime())) {
            const now = new Date();
            if (harvestDateValue >= now) {
              const currentNext = row.nextHarvestDate
                ? new Date(row.nextHarvestDate)
                : null;
              if (!currentNext || harvestDateValue < currentNext) {
                row.nextHarvestDate = harvestDateValue.toISOString();
              }
            }
          }
        });
      });
    }

    if (Array.isArray(harvests)) {
      harvests.forEach((harvest) => {
        const rooms = Array.isArray(harvest?.rooms) ? harvest.rooms : [];

        rooms.forEach((roomEntry) => {
          const strainsInRoom = Array.isArray(roomEntry?.strains)
            ? roomEntry.strains
            : [];

          strainsInRoom.forEach((strainEntry) => {
            const strainId = String(
              strainEntry?.strainId?._id || strainEntry?.strainId || "",
            );
            if (!strainId || !rowMap.has(strainId)) return;

            const row = rowMap.get(strainId);
            row.totalWetWeightGrams +=
              Number(strainEntry?.totalWetWeightGrams) || 0;
            row.totalDryWeightGrams +=
              Number(strainEntry?.totalDryWeightGrams) || 0;
            row.totalHarvestPlantCount += Number(strainEntry?.plantCount) || 0;
          });
        });
      });
    }

    return Array.from(rowMap.values())
      .map((row) => {
        const avgDryPerPlant = resolveAvgDryPerPlant(row.strain, {
          totalDryWeightGrams: row.totalDryWeightGrams,
          totalHarvestPlantCount: row.totalHarvestPlantCount,
        });

        const placements = row.plantsByRoom
          .map((placement) => ({
            ...placement,
            expectedYieldGrams: getExpectedYieldGrams({
              plantCount: placement.plantCount,
              avgDryPerPlant,
              batchType: placement.batchType,
            }),
          }))
          .sort(
            (a, b) =>
              (a.locationName || "").localeCompare(b.locationName || "") ||
              (a.roomName || "").localeCompare(b.roomName || ""),
          );

        const expectedYieldTotal = getNextHarvestExpectedYieldGrams(
          placements,
          row.nextHarvestDate,
        );

        return {
          ...row,
          avgDryPerPlant,
          expectedYieldTotal,
          plantsByRoom: placements,
          nextHarvestLabel: row.nextHarvestDate
            ? formatDate(row.nextHarvestDate)
            : "—",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [strains, roomAssignments, harvests]);

  const filteredSummaries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return strainSummaries;

    return strainSummaries.filter((row) => {
      const placementText = row.plantsByRoom
        .map(
          (item) =>
            `${item.roomName} ${item.locationName} ${item.batchNumber} ${item.lifecycleStage}`,
        )
        .join(" ")
        .toLowerCase();

      return (
        row.name.toLowerCase().includes(query) ||
        row.type.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query) ||
        row.nextHarvestLabel.toLowerCase().includes(query) ||
        placementText.includes(query)
      );
    });
  }, [strainSummaries, searchQuery]);

  // Default to the first strain so the detail panel is never empty on open.
  useEffect(() => {
    if (selectedStrainId) return;
    if (filteredSummaries[0]) {
      setSelectedStrainId(filteredSummaries[0].strainId);
    }
  }, [filteredSummaries, selectedStrainId]);

  useEffect(() => {
    if (!selectedStrainId) return;
    const stillVisible = filteredSummaries.some(
      (row) => row.strainId === selectedStrainId,
    );
    if (!stillVisible && filteredSummaries[0]) {
      setSelectedStrainId(filteredSummaries[0].strainId);
    }
  }, [filteredSummaries, selectedStrainId]);

  const selectedStrain = useMemo(() => {
    if (!selectedStrainId) return filteredSummaries[0] || null;
    return (
      filteredSummaries.find((row) => row.strainId === selectedStrainId) ||
      strainSummaries.find((row) => row.strainId === selectedStrainId) ||
      null
    );
  }, [filteredSummaries, selectedStrainId, strainSummaries]);

  if (strainSummaries.length === 0) {
    return <Alert severity="info">No strains yet.</Alert>;
  }

  const sidebarHeader = (
    <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
      <TextField
        size="small"
        fullWidth
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search strains, rooms, batches…"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        {filteredSummaries.length} of {strainSummaries.length} strains
      </Typography>
    </Box>
  );

  const sidebar = (
    <List dense disablePadding>
      {filteredSummaries.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No strains match your search.
          </Typography>
        </Box>
      ) : (
        filteredSummaries.map((row) => {
          const isSelected = selectedStrain?.strainId === row.strainId;

          return (
            <ListItemButton
              key={row.strainId}
              selected={isSelected}
              onClick={() => setSelectedStrainId(row.strainId)}
              sx={{ alignItems: "flex-start", py: 1.25 }}
            >
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {row.name}
                  </Typography>
                }
                secondary={
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Chip size="small" label={`${row.totalPlants} plants`} />
                    {row.nextHarvestLabel !== "—" ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Harvest ${row.nextHarvestLabel}`}
                      />
                    ) : null}
                  </Stack>
                }
              />
            </ListItemButton>
          );
        })
      )}
    </List>
  );

  const detail = selectedStrain ? (
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
                    })}
                  >
                    <SpaIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {selectedStrain.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <Chip size="small" label={selectedStrain.type} variant="outlined" />
                      <Chip size="small" label={selectedStrain.status} variant="outlined" />
                    </Stack>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ p: 2, overflow: "auto", flex: 1, minHeight: 0 }}>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard label="Live plants" value={selectedStrain.totalPlants} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard
                      label="Next harvest"
                      value={selectedStrain.nextHarvestLabel}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard
                      label="Avg dry / plant"
                      value={formatAvgGrams(selectedStrain.avgDryPerPlant)}
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <StatCard
                      label="Next harvest yield"
                      value={formatGrams(selectedStrain.expectedYieldTotal)}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Current room placements
                </Typography>

                {selectedStrain.plantsByRoom.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    This strain is not assigned to any active room yet.
                  </Alert>
                ) : (
                  <AnalyticsDataGrid
                    height={Math.min(
                      420,
                      Math.max(240, selectedStrain.plantsByRoom.length * 52 + 56),
                    )}
                    hideFooter={selectedStrain.plantsByRoom.length <= 8}
                    initialPageSize={10}
                    rows={selectedStrain.plantsByRoom.map((placement, index) => ({
                      id: `${selectedStrain.strainId}-${index}`,
                      locationName: placement.locationName,
                      roomName: placement.roomName,
                      batchNumber: placement.batchNumber,
                      lifecycleStage: placement.lifecycleStage,
                      plantCount: placement.plantCount,
                      harvestDate: formatDate(placement.batchHarvestDate) || "—",
                      expectedYield:
                        placement.batchType === "mom"
                          ? "—"
                          : formatGrams(placement.expectedYieldGrams),
                    }))}
                    columns={[
                      {
                        field: "locationName",
                        headerName: "Location",
                        flex: 1,
                        minWidth: 120,
                      },
                      { field: "roomName", headerName: "Room", flex: 0.9, minWidth: 100 },
                      {
                        field: "batchNumber",
                        headerName: "Batch",
                        flex: 0.8,
                        minWidth: 90,
                      },
                      {
                        field: "lifecycleStage",
                        headerName: "Stage",
                        flex: 0.8,
                        minWidth: 100,
                      },
                      {
                        field: "plantCount",
                        headerName: "Plants",
                        type: "number",
                        flex: 0.7,
                        minWidth: 80,
                      },
                      {
                        field: "harvestDate",
                        headerName: "Harvest",
                        flex: 0.9,
                        minWidth: 100,
                      },
                      {
                        field: "expectedYield",
                        headerName: "Est. dry yield",
                        flex: 1,
                        minWidth: 120,
                      },
                    ]}
                  />
                )}

                {selectedStrain.totalHarvestPlantCount > 0 ? (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" color="text.secondary">
                      Historical harvests:{" "}
                      {formatGrams(selectedStrain.totalDryWeightGrams)} dry from{" "}
                      {selectedStrain.totalHarvestPlantCount.toLocaleString()} plants
                    </Typography>
                  </>
                ) : null}
              </Box>
    </Paper>
  ) : (
    <Alert severity="info" sx={{ borderRadius: 2 }}>
      Select a strain from the list to view details.
    </Alert>
  );

  return (
    <Stack spacing={2} sx={{ height: "100%", minHeight: 480 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Strain Inventory
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse strains on the left, then review placements and projected yield on the right.
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

export default StrainDataViewer;
