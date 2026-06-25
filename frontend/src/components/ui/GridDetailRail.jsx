/**
 * GridDetailRail — side inspector panel for DataGrid row selection.
 * Sits beside the grid instead of below it so flex layouts do not clip content.
 */

import { Box, Chip, Collapse, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { alpha } from "@mui/material/styles";

export function DetailMetric({ label, value, hint }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

export default function GridDetailRail({
  open,
  title,
  subtitle,
  onClose,
  width = 300,
  children,
}) {
  return (
    <Collapse
      in={open}
      orientation="horizontal"
      collapsedSize={0}
      sx={{ flexShrink: 0, height: "100%", alignSelf: "stretch" }}
    >
      <Box
        sx={(theme) => ({
          width,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderLeft: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.22),
          bgcolor: alpha(theme.palette.background.paper, 0.98),
          boxShadow: `-12px 0 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.28 : 0.06)}`,
        })}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1}
          sx={(theme) => ({
            px: 1.5,
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "divider",
            background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.background.paper, 0.98)})`,
            flexShrink: 0,
          })}
        >
          <Box sx={{ minWidth: 0, pr: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <IconButton
            size="small"
            aria-label="Close details"
            onClick={onClose}
            sx={{ mt: -0.25, flexShrink: 0 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1.5 }}>{children}</Box>
      </Box>
    </Collapse>
  );
}

export function DetailMetricGrid({ metrics = [] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 1.25,
      }}
    >
      {metrics.map((metric) => (
        <DetailMetric
          key={metric.label}
          label={metric.label}
          value={metric.value}
          hint={metric.hint}
        />
      ))}
    </Box>
  );
}

export function DetailChipList({ label, values = [], emptyLabel = "None" }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      {values.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      ) : (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {values.map((value, index) => (
            <Chip key={`${value}-${index}`} size="small" label={value} variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  );
}
