import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Paper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Minimize";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

let globalZIndex = 1200;

export default function DraggableWindow({
  title,
  onClose,
  isMinimized = false,
  onMinimize,
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

  const bringToFront = () => {
    setZIndex(++globalZIndex);
  };

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

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!interaction.current) return;

      const { type } = interaction.current;

      if (type === "drag") {
        const dx = e.clientX - interaction.current.startClientX;
        const dy = e.clientY - interaction.current.startClientY;
        const nextX = interaction.current.startX + dx;
        const nextY = interaction.current.startY + dy;

        const maxX = Math.max(leftBound, window.innerWidth - sizeRef.current.w);
        const maxY = Math.max(0, window.innerHeight - 64 - sizeRef.current.h);

        setPos({
          x: Math.min(Math.max(leftBound, nextX), maxX),
          y: Math.min(Math.max(64, nextY), maxY),
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

  useEffect(() => {
    const maxX = Math.max(leftBound, window.innerWidth - sizeRef.current.w);
    const maxY = Math.max(0, window.innerHeight - 64 - sizeRef.current.h);

    setPos((prev) => {
      const next = {
        x: Math.min(Math.max(leftBound, prev.x), maxX),
        y: Math.min(Math.max(64, prev.y), maxY),
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
        <Stack
          onMouseDown={handleTitleMouseDown}
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 1.25,
            py: 0.8,
            borderBottom: "1px solid",
            borderColor: "divider",
            background:
              "linear-gradient(90deg, rgba(0,95,115,0.14), rgba(238,155,0,0.10))",
            cursor: "move",
          }}
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

          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" aria-label="Minimize" onClick={onMinimize}>
              <MinimizeIcon fontSize="small" />
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
        </Stack>

        <Stack sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 2 }}>
          {children}
        </Stack>

        <Box
          onMouseDown={handleResizeMouseDown}
          sx={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            background:
              "linear-gradient(135deg, transparent 0 40%, rgba(0,0,0,0.18) 40% 55%, transparent 55% 70%, rgba(0,0,0,0.3) 70% 85%, transparent 85%)",
          }}
        />
      </Paper>
    </Box>
  );
}
