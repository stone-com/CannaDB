import {
  Box,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";

// This component shows a full-page panel (like Admin) instead of a floating window.
// It has a title bar with buttons to exit full screen or close the panel.
export default function PanelView({
  title,
  onExitFullscreen,
  onClose,
  children,
}) {
  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      {/* Panel header with title and window controls */}
      <Paper
        elevation={0}
        sx={(theme) => ({
          position: "relative",
          px: 2,
          py: 1.25,
          pr: 9,
          borderBottom: "1px solid",
          borderColor: "divider",
          background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
        })}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>

        {/* Exit full screen and close buttons */}
        <Stack
          direction="row"
          spacing={0.25}
          alignItems="center"
          sx={{
            position: "absolute",
            top: 6,
            right: 6,
          }}
        >
          <IconButton
            size="small"
            aria-label="Exit full screen"
            onClick={onExitFullscreen}
            title="Return to floating window"
          >
            <FullscreenExitIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Close panel"
            color="error"
            onClick={onClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      {/* Scrollable main content area */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 3 }}>
        {children}
      </Box>
    </Stack>
  );
}
