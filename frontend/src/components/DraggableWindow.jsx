import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Minimize";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FullscreenIcon from "@mui/icons-material/Fullscreen";

let globalZIndex = 1200;

const APP_BAR_HEIGHT = 64;
const TASKBAR_HEIGHT = 64;

// This component renders a movable, resizable floating window on the screen.
// Users can drag the title bar, resize from the corner, minimize, or go full screen.
export default function DraggableWindow({
  title,
  onClose,
  isMinimized = false,
  onMinimize,
  onToggleFullscreen,
  children,
  leftBound = 0,
  defaultX = 120,
  defaultY = 120,
  defaultW = 540,
  defaultH = 460,
}) {
  const [pos, setPos] = useState({
    x: Math.max(leftBound, defaultX),
    y: defaultY,
  });
  const [size, setSize] = useState({ w: defaultW, h: defaultH });
  const [zIndex, setZIndex] = useState(() => ++globalZIndex);
  const interaction = useRef(null);
  const sizeRef = useRef({ w: defaultW, h: defaultH });

  sizeRef.current = size;

  // Brings this window to the front so it appears above other windows.
  const bringToFront = () => {
    setZIndex(++globalZIndex);
  };

  // Starts dragging when the user presses the mouse on the title bar.
  const handleTitleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    bringToFront();

    interaction.current = {
      type: "drag",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
  };

  // Starts resizing when the user presses the mouse on the corner handle.
  const handleResizeMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront();

    interaction.current = {
      type: "resize",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startW: size.w,
      startH: size.h,
    };
  };

  // Listens for mouse move and mouse up events to handle drag and resize.
  useEffect(() => {
    // Updates window position or size while the user moves the mouse.
    const onMouseMove = (e) => {
      if (!interaction.current) return;

      const { type } = interaction.current;

      if (type === "drag") {
        const dx = e.clientX - interaction.current.startClientX;
        const dy = e.clientY - interaction.current.startClientY;
        const nextX = interaction.current.startX + dx;
        const nextY = interaction.current.startY + dy;

        const maxX = Math.max(leftBound, window.innerWidth - sizeRef.current.w);
        const maxY = Math.max(
          0,
          window.innerHeight - TASKBAR_HEIGHT - sizeRef.current.h,
        );

        setPos({
          x: Math.min(Math.max(leftBound, nextX), maxX),
          y: Math.min(Math.max(APP_BAR_HEIGHT, nextY), maxY),
        });
      }

      if (type === "resize") {
        const dx = e.clientX - interaction.current.startClientX;
        const dy = e.clientY - interaction.current.startClientY;

        setSize({
          w: Math.max(360, interaction.current.startW + dx),
          h: Math.max(240, interaction.current.startH + dy),
        });
      }
    };

    // Stops drag or resize when the user releases the mouse button.
    const onMouseUp = () => {
      interaction.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [leftBound]);

  // Keeps the window inside the visible screen area when layout bounds change.
  useEffect(() => {
    const maxX = Math.max(leftBound, window.innerWidth - sizeRef.current.w);
    const maxY = Math.max(
      0,
      window.innerHeight - TASKBAR_HEIGHT - sizeRef.current.h,
    );

    setPos((prev) => {
      const next = {
        x: Math.min(Math.max(leftBound, prev.x), maxX),
        y: Math.min(Math.max(APP_BAR_HEIGHT, prev.y), maxY),
      };

      if (next.x === prev.x && next.y === prev.y) {
        return prev;
      }

      return next;
    });
  }, [leftBound]);

  if (isMinimized) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex,
      }}
      onMouseDown={bringToFront}
    >
      <Paper
        elevation={8}
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          border: "1px solid",
          borderColor: "divider",
          overflow: "visible",
        }}
      >
        {/* Title bar: drag handle, title text, and window buttons */}
        <Box
          onMouseDown={handleTitleMouseDown}
          sx={(theme) => ({
            position: "relative",
            px: 1.25,
            py: 0.8,
            pr: 11,
            borderBottom: "1px solid",
            borderColor: "divider",
            background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
            cursor: "move",
          })}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <DragIndicatorIcon
              fontSize="small"
              sx={{ color: "text.secondary" }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
          </Stack>

          {/* Minimize, full screen, and close buttons */}
          <Stack
            direction="row"
            spacing={0.25}
            alignItems="center"
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
            }}
          >
            <IconButton size="small" aria-label="Minimize" onClick={onMinimize}>
              <MinimizeIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Open full screen view"
              onClick={onToggleFullscreen}
            >
              <FullscreenIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Close"
              color="error"
              onClick={onClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        {/* Scrollable content area */}
        <Stack sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 2 }}>
          {children}
        </Stack>

        {/* Bottom-right corner handle for resizing */}
        <Box
          onMouseDown={handleResizeMouseDown}
          sx={(theme) => ({
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            background: `linear-gradient(135deg, transparent 0 40%, ${alpha(theme.palette.text.primary, 0.18)} 40% 55%, transparent 55% 70%, ${alpha(theme.palette.text.primary, 0.3)} 70% 85%, transparent 85%)`,
          })}
        />
      </Paper>
    </Box>
  );
}
