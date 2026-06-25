import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import HistoryIcon from "@mui/icons-material/History";
import { DataGrid } from "@mui/x-data-grid";
import { apiGet } from "../utils/api";

// Turns a date value into a readable date-and-time string for the table.
function formatDateTime(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

// Picks a chip color based on whether the action was create, update, or delete.
function actionColor(action) {
  if (action === "create") return "success";
  if (action === "update") return "info";
  if (action === "delete") return "error";
  return "default";
}

// This page shows a searchable table of recent user actions in the app.
// It loads audit log records from the server and displays who did what and when.
export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetches the latest audit log entries from the server.
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/api/audit-logs?limit=200");
      setLogs(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load audit logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const rows = useMemo(
    () =>
      logs.map((log) => ({
        id: log._id,
        occurredAt: log.occurredAt,
        userName: log.userId?.name || log.userId?.email || "Unknown user",
        userEmail: log.userId?.email || "",
        action: log.action,
        resourceType: log.resourceType,
        summary: log.summary,
      })),
    [logs],
  );

  const columns = useMemo(
    () => [
      {
        field: "occurredAt",
        headerName: "When",
        flex: 1,
        minWidth: 170,
        valueFormatter: (value) => formatDateTime(value),
      },
      {
        field: "userName",
        headerName: "User",
        flex: 0.9,
        minWidth: 140,
      },
      {
        field: "action",
        headerName: "Action",
        flex: 0.6,
        minWidth: 110,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.value}
            color={actionColor(params.value)}
            variant="outlined"
          />
        ),
      },
      {
        field: "resourceType",
        headerName: "Resource",
        flex: 0.7,
        minWidth: 130,
      },
      {
        field: "summary",
        headerName: "Summary",
        flex: 2,
        minWidth: 280,
      },
    ],
    [],
  );

  return (
    <Stack spacing={2.25} sx={{ p: { xs: 2, md: 3 }, height: "100%" }}>
      {/* Page header with title and description */}
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
        })}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <HistoryIcon color="primary" />
          <Stack spacing={0.25}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Activity Log
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Recent create, update, and delete actions for your organization.
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Error message if loading failed */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Data table of audit log entries */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 520,
          borderRadius: 2.25,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {loading && <LinearProgress />}
        <Box sx={{ flex: 1, minHeight: 480 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25, page: 0 } },
              sorting: { sortModel: [{ field: "occurredAt", sort: "desc" }] },
            }}
            sx={(theme) => ({
              border: "none",
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                fontWeight: 700,
              },
            })}
          />
        </Box>
      </Paper>
    </Stack>
  );
}
