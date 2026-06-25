/**
 * StatCard — small KPI tile used across analytics panels.
 */

import { Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

export default function StatCard({ label, value, hint, icon, compact = false }) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        p: compact ? 0.85 : 1.5,
        borderRadius: compact ? 1.5 : 2,
        height: "100%",
        bgcolor: alpha(theme.palette.background.paper, compact ? 0.5 : 0.7),
      })}
    >
      {icon ? (
        <Typography
          component="span"
          sx={{
            color: "text.secondary",
            display: "inline-flex",
            mb: compact ? 0.25 : 0.5,
            "& svg": { fontSize: compact ? "0.95rem" : undefined },
          }}
        >
          {icon}
        </Typography>
      ) : null}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={compact ? { fontSize: "0.68rem", lineHeight: 1.2, display: "block" } : undefined}
      >
        {label}
      </Typography>
      <Typography
        variant={compact ? "body2" : "h6"}
        sx={{ fontWeight: 800, mt: compact ? 0.1 : 0.25, lineHeight: 1.2 }}
      >
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" display="block">
          {hint}
        </Typography>
      ) : null}
    </Paper>
  );
}
