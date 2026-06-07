import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import "./index.css";
import App from "./App.jsx";

// Central MUI theme used by the entire frontend.
const theme = createTheme({
  // palette controls app-wide color tokens used by MUI components.
  palette: {
    mode: "light",
    primary: { main: "#005f73" },
    secondary: { main: "#ca6702" },
    background: {
      default: "#f2f7f8",
      paper: "#ffffff",
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
          boxShadow: "0 18px 44px rgba(11, 38, 56, 0.08)",
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
});

// React app entry point and top-level providers.
// We mount the entire React tree into the single #root element in index.html.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* StrictMode helps catch side effects and unsafe lifecycle patterns in development. */}
    {/* ThemeProvider makes the custom MUI theme available to all children. */}
    <ThemeProvider theme={theme}>
      {/* CssBaseline applies a consistent browser reset with sensible defaults. */}
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
