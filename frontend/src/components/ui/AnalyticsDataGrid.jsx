/**
 * AnalyticsDataGrid — shared table styling for harvest, room, and strain reports.
 */

import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";

const DEFAULT_PAGE_SIZES = [5, 10, 25, 50];

export default function AnalyticsDataGrid({
  height = 360,
  fill = false,
  hideFooter = false,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  initialPageSize = 10,
  sx,
  gridSx,
  ...props
}) {
  const containerSx = fill
    ? {
        width: "100%",
        flex: 1,
        minHeight: 220,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...sx,
      }
    : {
        width: "100%",
        height,
        minHeight: hideFooter ? 220 : height,
        ...sx,
      };

  return (
    <Box sx={containerSx}>
      <DataGrid
        disableRowSelectionOnClick
        hideFooter={hideFooter}
        pageSizeOptions={pageSizeOptions}
        initialState={{
          pagination: { paginationModel: { pageSize: initialPageSize, page: 0 } },
        }}
        sx={(theme) => ({
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.96),
          ...(fill ? { flex: 1, minHeight: 0 } : {}),
          "& .MuiDataGrid-columnHeaders": {
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            fontWeight: 700,
            fontSize: "0.8125rem",
          },
          "& .MuiDataGrid-cell": {
            borderColor: alpha(theme.palette.divider, 0.55),
            fontSize: "0.8125rem",
          },
          "& .MuiDataGrid-row:hover": {
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
          ...(typeof gridSx === "object" ? gridSx : {}),
        })}
        {...props}
      />
    </Box>
  );
}
