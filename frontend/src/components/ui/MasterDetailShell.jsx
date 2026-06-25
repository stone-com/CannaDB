/**
 * MasterDetailShell — scrollable sidebar + detail pane for workspace panels.
 * Supports an optional collapsible sidebar rail (fixed pixel width, animated).
 */

import { useState } from "react";
import {
  Box,
  Grid,
  IconButton,
  Paper,
  Tooltip,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const DEFAULT_SIDEBAR = { xs: 12, md: 4, lg: 3.5 };
const DEFAULT_DETAIL = { xs: 12, md: 8, lg: 8.5 };

export default function MasterDetailShell({
  sidebarHeader,
  sidebar,
  detail,
  sidebarWidth = DEFAULT_SIDEBAR,
  detailWidth = DEFAULT_DETAIL,
  height = "100%",
  mobileSidebarHeight = 300,
  sidebarCollapsible = false,
  sidebarExpanded,
  onSidebarExpandedChange,
  defaultSidebarExpanded = true,
  sidebarExpandedWidth = 260,
  sidebarCollapsedWidth = 72,
  collapseTooltipExpanded = "Collapse sidebar",
  collapseTooltipCollapsed = "Expand sidebar",
  sx,
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultSidebarExpanded);
  const isControlled = sidebarExpanded !== undefined;
  const isExpanded = sidebarCollapsible
    ? isControlled
      ? sidebarExpanded
      : internalExpanded
    : true;

  const setExpanded = (next) => {
    if (!sidebarCollapsible) return;
    if (!isControlled) setInternalExpanded(next);
    onSidebarExpandedChange?.(next);
  };

  const isFillHeight = height === "100%" || height === "fill";

  const shellSx = {
    minHeight: 0,
    flex: isFillHeight ? 1 : undefined,
    width: "100%",
    height: isFillHeight ? { xs: "auto", md: "100%" } : { xs: "auto", md: height },
    maxHeight: isFillHeight ? undefined : { xs: "none", md: height },
    ...sx,
  };

  const sidebarPaper = (
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
      {sidebarCollapsible ? (
        <Box
          sx={{
            px: isExpanded ? 1.25 : 0.75,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: isExpanded ? "flex-end" : "center",
          }}
        >
          <Tooltip title={isExpanded ? collapseTooltipExpanded : collapseTooltipCollapsed}>
            <IconButton
              size="small"
              aria-label={isExpanded ? collapseTooltipExpanded : collapseTooltipCollapsed}
              onClick={() => setExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronLeftIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}

      {isExpanded ? sidebarHeader : null}
      <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>{sidebar}</Box>
    </Paper>
  );

  if (sidebarCollapsible) {
    return (
      <Box
        sx={{
          ...shellSx,
          display: { xs: "block", md: "flex" },
          gap: 2,
          minWidth: 0,
        }}
      >
        <Box
          sx={(theme) => ({
            flexShrink: 0,
            minHeight: 0,
            height: { xs: mobileSidebarHeight, md: "100%" },
            width: {
              xs: "100%",
              md: isExpanded ? sidebarExpandedWidth : sidebarCollapsedWidth,
            },
            transition: theme.transitions.create("width", {
              duration: theme.transitions.duration.standard,
              easing: theme.transitions.easing.easeInOut,
            }),
          })}
        >
          {sidebarPaper}
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: { xs: "auto", md: "100%" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          {detail}
        </Box>
      </Box>
    );
  }

  return (
    <Grid container spacing={2} sx={shellSx}>
      <Grid
        size={sidebarWidth}
        sx={{
          minHeight: 0,
          height: { xs: mobileSidebarHeight, md: "100%" },
          display: "flex",
        }}
      >
        {sidebarPaper}
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
