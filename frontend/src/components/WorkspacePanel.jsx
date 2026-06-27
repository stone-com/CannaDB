/**
 * WorkspacePanel — one panel shell that stays mounted in floating or full-screen mode.
 * Keeps scroll position, form input, and window size when you toggle display mode.
 */

import { useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Minimize";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

let globalZIndex = 1200;
const MAX_PANEL_Z_INDEX = 1990;

function nextPanelZIndex() {
  globalZIndex = Math.min(globalZIndex + 1, MAX_PANEL_Z_INDEX);
  return globalZIndex;
}

const APP_BAR_HEIGHT = 64;
const TASKBAR_HEIGHT = 64;
const MIN_WIDTH = 380;
const MIN_HEIGHT = 260;

export default function WorkspacePanel({
  title,
  displayMode = "floating",
  layout,
  onLayoutChange,
  leftBound = 0,
  onClose,
  onMinimize,
  onToggleFullscreen,
  isFullscreen = false,
  children,
}) {
  const [zIndex, setZIndex] = useState(() => nextPanelZIndex());
  const interaction = useRef(null);
  const sizeRef = useRef({ w: layout.w, h: layout.h });
  const layoutRef = useRef(layout);

  sizeRef.current = { w: layout.w, h: layout.h };
  layoutRef.current = layout;

  const bringToFront = () => {
    setZIndex(nextPanelZIndex());
  };

  const commitLayout = (nextLayout) => {
    onLayoutChange(nextLayout);
  };

  const handleTitleMouseDown = (event) => {
    if (displayMode !== "floating" || event.button !== 0) return;
    event.preventDefault();
    bringToFront();

    interaction.current = {
      type: "drag",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layout.x,
      startY: layout.y,
    };
  };

  const handleResizeMouseDown = (event) => {
    if (displayMode !== "floating" || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    bringToFront();

    interaction.current = {
      type: "resize",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startW: layout.w,
      startH: layout.h,
    };
  };

  useEffect(() => {
    const onMouseMove = (event) => {
      if (!interaction.current) return;

      if (interaction.current.type === "drag") {
        const dx = event.clientX - interaction.current.startClientX;
        const dy = event.clientY - interaction.current.startClientY;
        const maxX = Math.max(leftBound, window.innerWidth - sizeRef.current.w);
        const maxY = Math.max(
          APP_BAR_HEIGHT,
          window.innerHeight - TASKBAR_HEIGHT - sizeRef.current.h,
        );

        commitLayout({
          ...layout,
          x: Math.min(Math.max(leftBound, interaction.current.startX + dx), maxX),
          y: Math.min(
            Math.max(APP_BAR_HEIGHT, interaction.current.startY + dy),
            maxY,
          ),
        });
      }

      if (interaction.current.type === "resize") {
        const dx = event.clientX - interaction.current.startClientX;
        const dy = event.clientY - interaction.current.startClientY;

        commitLayout({
          ...layout,
          w: Math.max(MIN_WIDTH, interaction.current.startW + dx),
          h: Math.max(MIN_HEIGHT, interaction.current.startH + dy),
        });
      }
    };

    const onMouseUp = () => {
      interaction.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [layout, leftBound, onLayoutChange]);

  // Keep floating windows inside the viewport when the sidebar resizes.
  useEffect(() => {
    if (displayMode !== "floating") return;

    const current = layoutRef.current;
    const maxX = Math.max(leftBound, window.innerWidth - current.w);
    const maxY = Math.max(
      APP_BAR_HEIGHT,
      window.innerHeight - TASKBAR_HEIGHT - current.h,
    );

    const nextX = Math.min(Math.max(leftBound, current.x), maxX);
    const nextY = Math.min(Math.max(APP_BAR_HEIGHT, current.y), maxY);

    if (nextX !== current.x || nextY !== current.y) {
      onLayoutChange({ ...current, x: nextX, y: nextY });
    }
  }, [displayMode, leftBound, onLayoutChange]);

  if (displayMode === "hidden") {
    return (
      <Box aria-hidden sx={{ display: "none" }}>
        {children}
      </Box>
    );
  }

  const isFloating = displayMode === "floating";

  const shellSx = isFloating
    ? {
        position: "fixed",
        left: layout.x,
        top: layout.y,
        width: layout.w,
        height: layout.h,
        zIndex,
      }
    : {
        position: "fixed",
        top: APP_BAR_HEIGHT,
        left: leftBound,
        right: 0,
        bottom: TASKBAR_HEIGHT,
        zIndex: 1100,
      };

  return (
    <Box sx={shellSx} onMouseDown={isFloating ? bringToFront : undefined}>
      <Paper
        elevation={isFloating ? 12 : 0}
        sx={(theme) => ({
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          border: "1px solid",
          borderColor: isFloating
            ? alpha(theme.palette.primary.main, 0.22)
            : "divider",
          borderRadius: isFloating ? 2.5 : 0,
          overflow: "hidden",
          boxShadow: isFloating
            ? `0 24px 60px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.45 : 0.16)}`
            : "none",
        })}
      >
        {/* Title bar — drag handle in floating mode */}
        <Box
          onMouseDown={handleTitleMouseDown}
          sx={(theme) => ({
            position: "relative",
            px: 1.5,
            py: 1,
            pr: isFloating ? 11 : 10,
            borderBottom: "1px solid",
            borderColor: "divider",
            background: isFloating
              ? `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.background.paper, 0.98)})`
              : `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
            cursor: isFloating ? "move" : "default",
            userSelect: "none",
          })}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            {isFloating ? (
              <DragIndicatorIcon fontSize="small" sx={{ color: "text.secondary" }} />
            ) : null}
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
          </Stack>

          {/* Window controls */}
          <Stack
            direction="row"
            spacing={0.25}
            alignItems="center"
            onMouseDown={(event) => event.stopPropagation()}
            sx={{ position: "absolute", top: 6, right: 6 }}
          >
            {isFloating ? (
              <Tooltip title="Minimize to taskbar">
                <IconButton size="small" aria-label="Minimize" onClick={onMinimize}>
                  <MinimizeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}

            <Tooltip title={isFullscreen ? "Restore window" : "Full screen"}>
              <IconButton
                size="small"
                aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? (
                  <FullscreenExitIcon fontSize="small" />
                ) : (
                  <FullscreenIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title="Close panel">
              <IconButton size="small" aria-label="Close" color="error" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Panel body — flex column so workspace pages can fill available height */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            p: { xs: 2, md: 2.5 },
          }}
        >
          {children}
        </Box>

        {/* Resize grip — floating mode only */}
        {isFloating ? (
          <Box
            onMouseDown={handleResizeMouseDown}
            sx={(theme) => ({
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 18,
              height: 18,
              cursor: "nwse-resize",
              background: `linear-gradient(135deg, transparent 0 42%, ${alpha(theme.palette.text.primary, 0.2)} 42% 58%, transparent 58% 72%, ${alpha(theme.palette.text.primary, 0.32)} 72% 88%, transparent 88%)`,
            })}
          />
        ) : null}
      </Paper>
    </Box>
  );
}
