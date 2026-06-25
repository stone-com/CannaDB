/**
 * FormSection — groups related fields inside a bordered card with a title.
 */

import { Box, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

export default function FormSection({ title, subtitle, children }) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        borderRadius: 2,
        boxShadow: "none",
        borderColor: alpha(theme.palette.divider, 0.85),
        overflow: "hidden",
      })}
    >
      {title ? (
        <Box
          sx={(theme) => ({
            px: { xs: 2, sm: 2.25 },
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: alpha(theme.palette.background.default, 0.35),
          })}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      <Box sx={{ p: { xs: 2, sm: 2.25 } }}>
        <Stack spacing={2}>{children}</Stack>
      </Box>
    </Paper>
  );
}
