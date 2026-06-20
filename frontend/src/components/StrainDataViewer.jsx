// StrainDataViewer — searchable table of all strains with plant counts, harvest dates, and yield history.
import { Fragment, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import { DataGrid } from "@mui/x-data-grid";
import { formatDate } from "../utils/formatDate";

// Main component: builds strain summary rows from assignments and harvest records.
function StrainDataViewer({ strains, roomAssignments, harvests }) {
  // Only one strain details panel can be open at a time.
  const [expandedStrainId, setExpandedStrainId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Build one summary row per strain.
  const strainRows = useMemo(() => {
    if (!Array.isArray(strains)) return [];

    // Map by strain ID so we can accumulate assignment + harvest metrics efficiently.
    const rowMap = new Map();

    strains.forEach((strain) => {
      rowMap.set(strain._id, {
        strainId: strain._id,
        name: strain.name || "N/A",
        type: strain.type || "N/A",
        status: strain.status || "N/A",
        totalPlants: 0,
        totalWetWeightGrams: 0,
        totalDryWeightGrams: 0,
        totalHarvestPlantCount: 0,
        nextHarvestDate: null,
        plantsByRoom: [],
      });
    });

    if (Array.isArray(roomAssignments)) {
      // Aggregate current room assignment plant counts into each strain row.
      roomAssignments.forEach((assignment) => {
        const room = assignment?.roomId;
        const batch = assignment?.batchId;
        const roomName = room?.name || "N/A";
        const locationName = room?.locationId?.nickname || "N/A";
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

          row.totalPlants += plantCount;
          row.plantsByRoom.push({
            roomName,
            locationName,
            plantCount,
            batchNumber: batch?.batchNumber || "N/A",
            batchType: batch?.batchType || "production",
            batchHarvestDate: batch?.harvestDate || null,
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
      // Aggregate historical wet/dry metrics from completed harvest data.
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

    // Add calculated display fields and sort.
    return Array.from(rowMap.values())
      .map((row) => ({
        ...row,
        avgDryWeightPerPlant:
          row.totalHarvestPlantCount > 0
            ? (row.totalDryWeightGrams / row.totalHarvestPlantCount).toFixed(2)
            : "N/A",
        wetToDryPercentChange:
          row.totalWetWeightGrams > 0
            ? (
                ((row.totalWetWeightGrams - row.totalDryWeightGrams) /
                  row.totalWetWeightGrams) *
                100
              ).toFixed(2)
            : "N/A",
        nextHarvest: row.nextHarvestDate
          ? formatDate(row.nextHarvestDate)
          : "N/A",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [strains, roomAssignments, harvests]);

  // Open or close the detail accordion when a table row is clicked.
  const toggleExpandedRow = (strainId) => {
    setExpandedStrainId((prev) => (prev === strainId ? null : strainId));
  };

  // Filter by high-signal fields plus room/batch text.
  const filteredRows = useMemo(() => {
    // Return all rows when search box is empty.
    const query = searchQuery.trim().toLowerCase();
    if (!query) return strainRows;

    return strainRows.filter((row) => {
      const roomSearchText = row.plantsByRoom
        .map(
          (item) => `${item.roomName} ${item.locationName} ${item.batchNumber}`,
        )
        .join(" ")
        .toLowerCase();

      return (
        row.name.toLowerCase().includes(query) ||
        row.type.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query) ||
        row.nextHarvest.toLowerCase().includes(query) ||
        roomSearchText.includes(query)
      );
    });
  }, [strainRows, searchQuery]);

  if (strainRows.length === 0) {
    // Early return keeps JSX simple when no source data exists.
    return <Alert severity="info">No strains yet.</Alert>;
  }

  const columns = [
    // Column config for MUI DataGrid table.
    {
      field: "name",
      headerName: "Strain",
      flex: 1.1,
      minWidth: 160,
    },
    {
      field: "type",
      headerName: "Type",
      flex: 0.8,
      minWidth: 120,
      renderCell: ({ value }) => (
        // Show strain type as a small outlined chip in the table cell.
        <Chip size="small" label={value} variant="outlined" />
      ),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.9,
      minWidth: 130,
    },
    {
      field: "totalPlants",
      headerName: "Plants",
      type: "number",
      minWidth: 100,
      flex: 0.7,
    },
    {
      field: "nextHarvest",
      headerName: "Next Harvest",
      minWidth: 140,
      flex: 1,
    },
  ];

  return (
    <Stack spacing={2.25} sx={{ width: "100%" }}>
      {/* Top control card: title + search + result count. */}
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
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Strain Viewer
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Live plants, upcoming harvest visibility, and historical yield
              context.
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <TextField
              size="small"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search strains, type, status, room, location, or batch"
              sx={{ minWidth: { xs: "100%", sm: 360 } }}
              InputProps={{
                // Search icon rendered inside the input for context.
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Typography variant="body2" color="text.secondary">
              {/* Live count updates as searchQuery filters the rows. */}
              Showing {filteredRows.length} of {strainRows.length}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Strain summary table — click a row to expand details below. */}
      <Box sx={{ height: 380, width: "100%" }}>
        <DataGrid
          // DataGrid gives sorting/pagination behavior without custom table plumbing.
          rows={filteredRows.map((row) => ({ ...row, id: row.strainId }))}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10, page: 0 } },
          }}
          onRowClick={(params) => toggleExpandedRow(params.id)}
          sx={(theme) => ({
            borderRadius: 1.75,
            borderColor: "divider",
            backgroundColor: alpha(theme.palette.background.paper, 0.9),
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: alpha(theme.palette.primary.main, 0.14),
              fontWeight: 700,
            },
          })}
        />
      </Box>

      {/* Expanded detail accordions — one appears below the table for the clicked strain. */}
      {filteredRows.map((row) => (
        <Fragment key={row.strainId}>
          {expandedStrainId === row.strainId && (
            <Accordion
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
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={(theme) => ({
                  background: `linear-gradient(90deg, ${alpha(theme.palette.success.main, 0.08)}, ${alpha(theme.palette.success.main, 0.02)})`,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                })}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  {row.name} Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Historical average dry weight per plant:{" "}
                    <strong>{row.avgDryWeightPerPlant}</strong>
                    {row.avgDryWeightPerPlant !== "N/A" ? " g" : ""}
                  </Typography>
                  <Typography variant="body2">
                    Historical wet-to-dry change:{" "}
                    <strong>
                      {row.wetToDryPercentChange === "N/A"
                        ? "N/A"
                        : `${row.wetToDryPercentChange}%`}
                    </strong>
                  </Typography>
                </Stack>

                {row.plantsByRoom.length === 0 ? (
                  <Typography color="text.secondary">
                    No plant/room data available yet.
                  </Typography>
                ) : (
                  <>
                    {/* Room/batch breakdown table for this strain. */}
                    <Box sx={{ height: 300 }}>
                    <DataGrid
                      rows={row.plantsByRoom.map((item, index) => ({
                        // Row IDs combine strain + index so DataGrid keys stay stable.
                        ...item,
                        id: `${row.strainId}-${index}`,
                        batchHarvestDate: formatDate(item.batchHarvestDate),
                      }))}
                      columns={[
                        {
                          field: "roomName",
                          headerName: "Room",
                          flex: 1,
                          minWidth: 120,
                        },
                        {
                          field: "locationName",
                          headerName: "Location",
                          flex: 1,
                          minWidth: 120,
                        },
                        {
                          field: "batchNumber",
                          headerName: "Batch",
                          flex: 1,
                          minWidth: 120,
                        },
                        {
                          field: "plantCount",
                          headerName: "Plant Count",
                          type: "number",
                          flex: 1,
                          minWidth: 120,
                        },
                        {
                          field: "batchHarvestDate",
                          headerName: "Batch Harvest Date",
                          flex: 1.2,
                          minWidth: 160,
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
                  </>
                )}
              </AccordionDetails>
            </Accordion>
          )}
        </Fragment>
      ))}
    </Stack>
  );
}

export default StrainDataViewer;
