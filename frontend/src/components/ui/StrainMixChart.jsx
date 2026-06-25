/**
 * StrainMixChart — horizontal bar chart for room strain counts (one color per strain).
 */

import { useTheme } from "@mui/material/styles";
import { BarChart } from "@mui/x-charts/BarChart";

const PALETTE_KEYS = ["primary", "secondary", "success", "warning", "info", "error"];

function buildChartColors(theme, count) {
  return Array.from({ length: count }, (_, index) => {
    const key = PALETTE_KEYS[index % PALETTE_KEYS.length];
    return theme.palette[key]?.main || theme.palette.primary.main;
  });
}

export default function StrainMixChart({ strains = [] }) {
  const theme = useTheme();
  const rows = Array.isArray(strains)
    ? [...strains].filter((row) => row.count > 0).sort((a, b) => b.count - a.count)
    : [];

  if (rows.length === 0) {
    return null;
  }

  const colors = buildChartColors(theme, rows.length);
  const labels = rows.map((row) => row.name);
  const chartHeight = Math.min(420, Math.max(180, rows.length * 44 + 72));

  return (
    <BarChart
      layout="horizontal"
      height={chartHeight}
      yAxis={[
        {
          scaleType: "band",
          data: labels,
          tickLabelStyle: {
            fontSize: 12,
            fill: theme.palette.text.primary,
          },
        },
      ]}
      xAxis={[
        {
          tickLabelStyle: {
            fontSize: 11,
            fill: theme.palette.text.secondary,
          },
        },
      ]}
      series={rows.map((row, index) => ({
        data: rows.map((_, rowIndex) => (rowIndex === index ? row.count : 0)),
        label: row.name,
        stack: "strainMix",
        color: colors[index],
        valueFormatter: (value) =>
          value == null || value === 0
            ? ""
            : `${Number(value).toLocaleString()} plants`,
      }))}
      margin={{ left: 12, right: 16, top: 12, bottom: 28 }}
      grid={{ vertical: true }}
      slotProps={{ legend: { hidden: true } }}
      sx={{
        "& .MuiChartsAxis-line": { stroke: theme.palette.divider },
        "& .MuiChartsGrid-line": {
          stroke: theme.palette.divider,
          strokeDasharray: "4 4",
        },
      }}
    />
  );
}
