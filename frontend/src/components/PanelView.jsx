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

// Dedicated full-page panel view (like Admin) — no sidebar, no floating window.
export default function PanelView({
  title,
  onExitFullscreen,
  onClose,
  children,
}) {
  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
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

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 3 }}>
        {children}
      </Box>
    </Stack>
  );
}
