/**
 * MasterDetailShell — fixed-height scrollable sidebar + detail pane for workspace panels.
 * Avoids unbounded list growth and keeps pickers inside the panel (no popover z-index issues).
 */

import { Box, Grid, Paper } from "@mui/material";

const DEFAULT_SIDEBAR = { xs: 12, md: 4, lg: 3.5 };
const DEFAULT_DETAIL = { xs: 12, md: 8, lg: 8.5 };

export default function MasterDetailShell({
  sidebarHeader,
  sidebar,
  detail,
  sidebarWidth = DEFAULT_SIDEBAR,
  detailWidth = DEFAULT_DETAIL,
  height = 540,
  mobileSidebarHeight = 300,
}) {
  return (
    <Grid
      container
      spacing={2}
      sx={{
        minHeight: 0,
        height: { xs: "auto", md: height },
        maxHeight: { xs: "none", md: height },
      }}
    >
      <Grid
        size={sidebarWidth}
        sx={{
          minHeight: 0,
          height: { xs: mobileSidebarHeight, md: "100%" },
          display: "flex",
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            borderRadius: 2,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {sidebarHeader}
          <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>{sidebar}</Box>
        </Paper>
      </Grid>

      <Grid
        size={detailWidth}
        sx={{
          minHeight: 0,
          height: { xs: "auto", md: "100%" },
          display: "flex",
          flexDirection: "column",
        }}
      >
        {detail}
      </Grid>
    </Grid>
  );
}
