import { Fragment, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DataGrid } from "@mui/x-data-grid";
import { formatDate } from "../utils/formatDate";

// Build dropdown label for one harvest.
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

function HarvestReportPage({ harvests }) {
  const [selectedHarvestId, setSelectedHarvestId] = useState("");
  const [expandedRows, setExpandedRows] = useState({});

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
    () =>
      sortedHarvests.find(
        (harvest) => harvest._id === effectiveSelectedHarvestId,
      ),
    [effectiveSelectedHarvestId, sortedHarvests],
  );

  // Build room sections and strain rows for display.
  const roomSections = useMemo(() => {
    if (!selectedHarvest || !Array.isArray(selectedHarvest.rooms)) return [];

    const sections = [];

    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      const roomId = roomEntry?.roomId;
      const roomName = roomId?.name || "N/A";
      const roomType = roomId?.type || "N/A";
      const roomSqFoot = roomId?.sqFoot ?? "N/A";
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
    () => roomSections.map((s) => s.roomName).join(", ") || "N/A",
    [roomSections],
  );

  const locationName = selectedHarvest?.locationId?.nickname || "N/A";

  const toggleExpandedRow = (rowKey) => {
    setExpandedRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  return (
    <Stack spacing={2}>
      <Stack>
        <Typography variant="h5">Harvest Report</Typography>
        <Typography color="text.secondary" variant="body2">
          Select a harvest date to view full room and strain details.
        </Typography>
      </Stack>

      <TextField
        select
        fullWidth
        label="Harvest Date"
        value={effectiveSelectedHarvestId}
        onChange={(e) => {
          setSelectedHarvestId(e.target.value);
          setExpandedRows({});
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

      {!selectedHarvest ? (
        <Alert severity="info">No harvest selected.</Alert>
      ) : (
        <>
          <Grid container spacing={2}>
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
              ["Total Plants", selectedHarvest.totalPlantCount ?? 0],
              ["Total Wet (g)", selectedHarvest.totalWetWeightGrams ?? 0],
              ["Total Dry (g)", selectedHarvest.totalDryWeightGrams ?? 0],
              [
                "Yield (g / sq ft)",
                selectedHarvest.totalYieldGramsPerSquareFoot ?? "N/A",
              ],
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
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

          {roomSections.length === 0 ? (
            <Alert severity="info">
              No room/strain rows found for this harvest.
            </Alert>
          ) : (
            roomSections.map((section) => (
              <Accordion key={section.roomSectionKey} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack>
                    <Typography sx={{ fontWeight: 700 }}>
                      Room: {section.roomName} ({section.roomType})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sq Ft: {section.roomSqFoot}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {section.strainRows.length === 0 ? (
                    <Alert severity="info">
                      No strains found for this room.
                    </Alert>
                  ) : (
                    <>
                      <Box sx={{ height: 320, mb: 2 }}>
                        <DataGrid
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
                            },
                            {
                              field: "totalWetWeightGrams",
                              headerName: "Wet Weight (g)",
                              type: "number",
                              flex: 0.9,
                              minWidth: 130,
                            },
                            {
                              field: "totalDryWeightGrams",
                              headerName: "Dry Weight (g)",
                              type: "number",
                              flex: 0.9,
                              minWidth: 130,
                            },
                            {
                              field: "yieldGramsPerSquareFoot",
                              headerName: "Yield (g/sq ft)",
                              flex: 0.9,
                              minWidth: 130,
                            },
                            {
                              field: "dryPlantAvgWeightGrams",
                              headerName: "Dry Avg (g/plant)",
                              flex: 1,
                              minWidth: 140,
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
                        />
                      </Box>

                      {section.strainRows.map((row) => (
                        <Fragment key={`${row.key}-detail`}>
                          {expandedRows[row.key] && (
                            <Card variant="outlined" sx={{ mb: 1.5 }}>
                              <CardContent>
                                <Typography
                                  variant="subtitle1"
                                  sx={{ mb: 1, fontWeight: 700 }}
                                >
                                  {row.strainName} Details
                                </Typography>
                                <Stack spacing={0.5}>
                                  <Typography variant="body2">
                                    Wet Avg / Plant (g):{" "}
                                    <strong>
                                      {row.wetPlantAvgWeightGrams}
                                    </strong>
                                  </Typography>
                                  <Typography variant="body2">
                                    % Change Wet→Dry:{" "}
                                    <strong>{row.percentChangeWetToDry}</strong>
                                  </Typography>
                                  <Typography variant="body2">
                                    Tote Wet Weights:{" "}
                                    <strong>
                                      {row.totes.length === 0
                                        ? "None"
                                        : row.totes
                                            .map((tote) => tote?.wetWeight ?? 0)
                                            .join(", ")}
                                    </strong>
                                  </Typography>
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
