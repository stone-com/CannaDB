/**
 * ListRow — one horizontal row with a label on the left and optional actions on the right.
 * Used for plant lists, tote lists, and any repeatable form entries.
 */

import { Box, Stack } from "@mui/material";

export default function ListRow({ label, children, sx }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1.5}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        px: 1.5,
        py: 0.75,
        bgcolor: "background.paper",
        minHeight: 44,
        ...sx,
      }}
    >
      {/* Main row content (strain name, tote weight, etc.) */}
      <Box sx={{ minWidth: 0, flex: 1 }}>{label}</Box>

      {/* Optional action slot — usually a RemoveButton */}
      {children ? (
        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {children}
        </Box>
      ) : null}
    </Stack>
  );
}
