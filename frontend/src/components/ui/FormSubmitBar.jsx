/**
 * FormSubmitBar — primary submit button with consistent spacing above feedback alerts.
 */

import { Box, Button, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";

export default function FormSubmitBar({
  children,
  type = "submit",
  color = "primary",
  disabled = false,
  fullWidth = false,
}) {
  return (
    <Box
      sx={(theme) => ({
        pt: 1.5,
        mt: 0.5,
        borderTop: "1px solid",
        borderColor: alpha(theme.palette.divider, 0.85),
      })}
    >
      <Stack spacing={1.5}>
        <Button
          type={type}
          variant="contained"
          color={color}
          disabled={disabled}
          fullWidth={fullWidth}
          size="medium"
          sx={{ alignSelf: fullWidth ? "stretch" : "flex-start", minWidth: 168 }}
        >
          {children}
        </Button>
      </Stack>
    </Box>
  );
}
