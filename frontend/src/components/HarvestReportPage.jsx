// HarvestReportPage — pick a harvest to view totals, room breakdowns, and per-strain weight metrics.
import { Fragment, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GrassIcon from "@mui/icons-material/Grass";
import ScaleIcon from "@mui/icons-material/Scale";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import { DataGrid } from "@mui/x-data-grid";
import { formatDate } from "../utils/formatDate";

// Round a number to one decimal place (returns null if the value is not a valid number).
const roundToTenth = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 10) / 10;
};

// Format a weight number for display with one decimal place, or "N/A" when missing.
const formatHarvestMetric = (value) => {
  if (value === null || value === undefined || value === "N/A") return "N/A";
  if (typeof value === "string" && value.trim() === "") return "N/A";

  const rounded = roundToTenth(value);
  if (rounded === null) return value;

  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
};

// Format a percentage value for display, adding a "%" suffix when valid.
const formatHarvestPercent = (value) => {
  const formatted = formatHarvestMetric(value);
  return formatted === "N/A" ? formatted : `${formatted}%`;
};

// Join all tote wet weights into a comma-separated string for display.
const formatToteWeights = (totes) => {
  if (!Array.isArray(totes) || totes.length === 0) return "None";
  return totes
    .map((tote) => formatHarvestMetric(tote?.wetWeight ?? 0))
    .join(", ");
};

// Build the text label shown for each harvest in the dropdown selector.
const buildHarvestOptionLabel = (harvest) => {
  if (!harvest) return "N/A";

  const dateText = formatDate(harvest.harvestDate);
  const harvestNumberText = harvest.harvestNumber || "No Number";
  const locationText = harvest.locationId?.nickname || "No Location";

  const rooms = Array.isArray(harvest.rooms) ? harvest.rooms : [];
  const roomNames = rooms
    .map((roomEntry) => roomEntry?.roomId?.name)
    .filter(Boolean)
    .join(", ");

  return `${dateText} — ${harvestNumberText} — ${locationText} — ${roomNames || "No Rooms"}`;
};

// Main component: shows harvest summary cards, metadata, and room-by-room strain tables.
function HarvestReportPage({ harvests }) {
  // Dropdown selection + row expansion state for the report view.
  const [selectedHarvestId, setSelectedHarvestId] = useState("");
  const [expandedRowKey, setExpandedRowKey] = useState(null);

  // Show newest harvests first.
  const sortedHarvests = useMemo(() => {
    if (!Array.isArray(harvests)) return [];
    return [...harvests].sort(
      (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
    );
  }, [harvests]);

  // Keep current selection, otherwise default to newest harvest.
  const effectiveSelectedHarvestId = useMemo(() => {
    if (sortedHarvests.length === 0) return "";
    const stillExists = sortedHarvests.some((h) => h._id === selectedHarvestId);
    if (selectedHarvestId && stillExists) return selectedHarvestId;
    return sortedHarvests[0]._id;
  }, [selectedHarvestId, sortedHarvests]);

  const selectedHarvest = useMemo(
    // Resolve effective selected id into the full harvest object for this page.
    () =>
      sortedHarvests.find(
        (harvest) => harvest._id === effectiveSelectedHarvestId,
      ),
    [effectiveSelectedHarvestId, sortedHarvests],
  );

  // Build room sections and strain rows for display.
  const roomSections = useMemo(() => {
    // Transform nested harvest data into room sections and table-ready strain rows.
    if (!selectedHarvest || !Array.isArray(selectedHarvest.rooms)) return [];

    const sections = [];

    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      const roomId = roomEntry?.roomId;
      const roomName = roomId?.name || "N/A";
      const roomType = roomId?.type || "N/A";
      const roomSqFoot =
        roomId?.sqFoot == null ? "N/A" : roundToTenth(roomId.sqFoot);
      const roomSectionKey = `${selectedHarvest._id}-room-${roomIndex}`;

      const strains = Array.isArray(roomEntry?.strains)
        ? roomEntry.strains
        : [];

      const strainRows = strains.map((strainEntry, strainIndex) => {
        const strainId = strainEntry?.strainId;
        const strainName = strainId?.name || "N/A";

        return {
          key: `${selectedHarvest._id}-${roomIndex}-${strainIndex}`,
          strainName,
          plantCount: strainEntry?.plantCount ?? 0,
          totalWetWeightGrams: strainEntry?.totalWetWeightGrams ?? 0,
          totalDryWeightGrams: strainEntry?.totalDryWeightGrams ?? 0,
          wetPlantAvgWeightGrams: strainEntry?.wetPlantAvgWeightGrams ?? "N/A",
          dryPlantAvgWeightGrams: strainEntry?.dryPlantAvgWeightGrams ?? "N/A",
          percentChangeWetToDry: strainEntry?.percentChangeWetToDry ?? "N/A",
          yieldGramsPerSquareFoot:
            strainEntry?.yieldGramsPerSquareFoot ?? "N/A",
          totes: Array.isArray(strainEntry?.totes) ? strainEntry.totes : [],
        };
      });

      sections.push({
        roomSectionKey,
        roomName,
        roomType,
        roomSqFoot,
        strainRows,
      });
    });

    return sections;
  }, [selectedHarvest]);

  const roomNamesSummary = useMemo(
    // Build comma-separated room names for summary metadata section.
    () => roomSections.map((s) => s.roomName).join(", ") || "N/A",
    [roomSections],
  );

  const locationName = selectedHarvest?.locationId?.nickname || "N/A";

  const formatMetric = formatHarvestMetric;

  const gridValueFormatter = (value) => formatHarvestMetric(value);

  const summaryCards = useMemo(
    // Metadata array used to render summary cards with one map() pass.
    () => [
      {
        label: "Total Plants",
        value: selectedHarvest?.totalPlantCount ?? 0,
        icon: <GrassIcon fontSize="small" />,
        tone: "primary",
      },
      {
        label: "Total Wet (g)",
        value: selectedHarvest?.totalWetWeightGrams ?? 0,
        icon: <ScaleIcon fontSize="small" />,
        tone: "info",
      },
      {
        label: "Total Dry (g)",
        value: selectedHarvest?.totalDryWeightGrams ?? 0,
        icon: <ScaleIcon fontSize="small" />,
        tone: "warning",
      },
      {
        label: "Yield (g / sq ft)",
        value: selectedHarvest?.totalYieldGramsPerSquareFoot ?? "N/A",
        icon: <WarehouseIcon fontSize="small" />,
        tone: "secondary",
      },
    ],
    [selectedHarvest],
  );

  // Expand/collapse one strain detail row at a time.
  const toggleExpandedRow = (rowKey) => {
    setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey));
  };

  // Render harvest header, summary metrics, room accordions, and strain details.
  return (
    <Stack spacing={2.25}>
      {/* Header card: report title, selected date chip, and harvest selector. */}
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
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={1}
          >
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Harvest Report
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Complete room and strain breakdown for each harvest run.
              </Typography>
            </Stack>
            {selectedHarvest && (
              <Chip
                label={`Date: ${formatDate(selectedHarvest.harvestDate)}`}
                color="success"
                variant="outlined"
              />
            )}
          </Stack>

          <TextField
            select
            fullWidth
            label="Select Harvest"
            value={effectiveSelectedHarvestId}
            // Changing harvest resets expanded detail row selection.
            onChange={(e) => {
              setSelectedHarvestId(e.target.value);
              setExpandedRowKey(null);
            }}
          >
            {sortedHarvests.length === 0 && (
              <MenuItem value="">No harvests</MenuItem>
            )}
            {sortedHarvests.map((harvest) => (
              <MenuItem key={harvest._id} value={harvest._id}>
                {buildHarvestOptionLabel(harvest)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {!selectedHarvest ? (
        // Alert is used for empty states to keep messaging visible and consistent.
        <Alert severity="info">No harvest selected.</Alert>
      ) : (
        <>
          {/* Summary metrics rendered as responsive cards. */}
          <Grid container spacing={1.5}>
            {summaryCards.map((card) => (
              // Each summary card is rendered from the metadata array above.
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
                    minHeight: 108,
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
                        {formatMetric(card.value)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper
            elevation={0}
            sx={(theme) => ({
              p: { xs: 1.5, md: 2 },
              borderRadius: 2.25,
              border: "1px solid",
              borderColor: "divider",
              background:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.background.paper, 0.9)
                  : alpha(theme.palette.background.paper, 0.9),
            })}
          >
            {/* Key/value metadata block for quick harvest context. */}
            <Grid container spacing={1.25}>
              {[
                ["Harvest Number", selectedHarvest.harvestNumber || "N/A"],
                ["Location", locationName],
                ["Rooms", roomNamesSummary],
                [
                  "Total Strains",
                  roomSections.reduce(
                    (total, section) => total + section.strainRows.length,
                    0,
                  ),
                ],
              ].map(([label, value]) => (
                // Render one key/value row for each harvest metadata field.
                <Grid key={label} size={{ xs: 12, md: 6 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      px: 1.25,
                      py: 1,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      backgroundColor: "background.paper",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {formatMetric(value)}
                    </Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Room accordions — each room lists its strains in a sortable table. */}
          {roomSections.length === 0 ? (
            <Alert severity="info">
              No room/strain rows found for this harvest.
            </Alert>
          ) : (
            roomSections.map((section) => (
              // Render one accordion per room to group its strain rows together.
              <Accordion
                key={section.roomSectionKey}
                defaultExpanded
                elevation={0}
                sx={(theme) => ({
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "12px !important",
                  overflow: "hidden",
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  "&::before": { display: "none" },
                })}
              >
                {/* Each accordion represents one room with a strain table inside. */}
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={(theme) => ({
                    background: `linear-gradient(90deg, ${alpha(theme.palette.success.main, 0.08)}, ${alpha(theme.palette.success.main, 0.02)})`,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  })}
                >
                  <Stack>
                    <Typography sx={{ fontWeight: 800 }}>
                      Room: {section.roomName} ({section.roomType})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sq Ft: {formatMetric(section.roomSqFoot)} • Strains:{" "}
                      {section.strainRows.length}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2 }}>
                  {section.strainRows.length === 0 ? (
                    <Alert severity="info">
                      No strains found for this room.
                    </Alert>
                  ) : (
                    <>
                      <Box sx={{ height: 340, mb: 2 }}>
                        <DataGrid
                          // DataGrid handles sorting/paging and column sizing for strain metrics.
                          rows={section.strainRows.map((row) => ({
                            ...row,
                            id: row.key,
                          }))}
                          columns={[
                            {
                              field: "strainName",
                              headerName: "Strain",
                              flex: 1,
                              minWidth: 140,
                            },
                            {
                              field: "plantCount",
                              headerName: "Plant Count",
                              type: "number",
                              flex: 0.8,
                              minWidth: 120,
                              valueFormatter: gridValueFormatter,
                            },
                            {
                              field: "totalWetWeightGrams",
                              headerName: "Wet Weight (g)",
                              type: "number",
                              flex: 0.9,
                              minWidth: 130,
                              valueFormatter: gridValueFormatter,
                            },
                            {
                              field: "totalDryWeightGrams",
                              headerName: "Dry Weight (g)",
                              type: "number",
                              flex: 0.9,
                              minWidth: 130,
                              valueFormatter: gridValueFormatter,
                            },
                            {
                              field: "yieldGramsPerSquareFoot",
                              headerName: "Yield (g/sq ft)",
                              flex: 0.9,
                              minWidth: 130,
                              valueFormatter: gridValueFormatter,
                            },
                            {
                              field: "dryPlantAvgWeightGrams",
                              headerName: "Dry Avg (g/plant)",
                              flex: 1,
                              minWidth: 140,
                              valueFormatter: gridValueFormatter,
                            },
                          ]}
                          pageSizeOptions={[5, 10]}
                          initialState={{
                            pagination: {
                              paginationModel: { pageSize: 5, page: 0 },
                            },
                          }}
                          disableRowSelectionOnClick
                          onRowClick={(params) => toggleExpandedRow(params.id)}
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

                      {/* Expanded strain detail card — shows averages and tote weights. */}
                      {section.strainRows.map((row) => (
                        <Fragment key={`${row.key}-detail`}>
                          {expandedRowKey === row.key && (
                            // Expanded card shows secondary metrics and tote-level data.
                            <Card
                              variant="outlined"
                              sx={{
                                mb: 1.5,
                                borderRadius: 2,
                                borderColor: "divider",
                              }}
                            >
                              <CardContent>
                                <Stack spacing={1.25}>
                                  <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 800 }}
                                  >
                                    {row.strainName} Details
                                  </Typography>
                                  <Divider />
                                  <Grid container spacing={1.25}>
                                    {[
                                      [
                                        "Wet Avg / Plant (g)",
                                        formatHarvestMetric(row.wetPlantAvgWeightGrams),
                                      ],
                                      [
                                        "% Change Wet→Dry",
                                        formatHarvestPercent(row.percentChangeWetToDry),
                                      ],
                                      [
                                        "Tote Wet Weights",
                                        formatToteWeights(row.totes),
                                      ],
                                    ].map(([label, value]) => (
                                      <Grid
                                        key={`${row.key}-${label}`}
                                        size={{ xs: 12, md: 4 }}
                                      >
                                        <Stack
                                          spacing={0.25}
                                          sx={(theme) => ({
                                            p: 1,
                                            borderRadius: 1.25,
                                            border: "1px solid",
                                            borderColor: "divider",
                                            backgroundColor: alpha(
                                              theme.palette.background.paper,
                                              0.95,
                                            ),
                                          })}
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
                                </Stack>
                              </CardContent>
                            </Card>
                          )}
                        </Fragment>
                      ))}
                    </>
                  )}
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </>
      )}
    </Stack>
  );
}

export default HarvestReportPage;
