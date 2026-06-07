import { useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { amber, blueGrey, cyan, green, grey, teal } from "@mui/material/colors";
import App from "./App.jsx";

// App-level wrapper that stores light/dark theme mode and provides MUI theme.
export default function ThemeRoot() {
  // Track current visual mode for the whole application.
  const [darkMode, setDarkMode] = useState(false);

  // Rebuild theme whenever mode changes so all MUI components update together.
  const theme = useMemo(
    () =>
      createTheme({
        // palette controls app-wide color tokens used by MUI components.
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: darkMode ? green[300] : teal[900] },
          secondary: { main: darkMode ? teal[200] : amber[800] },
          ...(darkMode
            ? {
                text: {
                  primary: grey[200],
                  secondary: blueGrey[200],
                },
                divider: alpha(grey[400], 0.24),
              }
            : {}),
          background: darkMode
            ? {
                default: blueGrey[900],
                paper: blueGrey[800],
              }
            : {
                default: cyan[50],
                paper: grey[50],
              },
        },
        // shape sets default corner roundness for many controls/cards.
        shape: {
          borderRadius: 14,
        },
        // typography sets default font family and heading/button behavior.
        typography: {
          fontFamily: '"Manrope", "Segoe UI", sans-serif',
          h4: { fontWeight: 800, letterSpacing: "-0.02em" },
          h5: { fontWeight: 700, letterSpacing: "-0.01em" },
          h6: { fontWeight: 700 },
          button: { fontWeight: 700, textTransform: "none" },
        },
        // components lets us override defaults for specific MUI components globally.
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                boxShadow: darkMode
                  ? `0 18px 44px ${alpha(grey[900], 0.45)}`
                  : `0 18px 44px ${alpha(teal[900], 0.08)}`,
                backgroundImage: "none",
              },
            },
          },
          MuiDataGrid: {
            styleOverrides: {
              root: {
                border: 0,
              },
            },
          },
        },
      }),
    [darkMode],
  );

  return (
    // ThemeProvider makes the custom MUI theme available to all children.
    <ThemeProvider theme={theme}>
      {/* CssBaseline applies a consistent browser reset with sensible defaults. */}
      <CssBaseline />
      <App
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />
    </ThemeProvider>
  );
}
