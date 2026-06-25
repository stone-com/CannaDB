/**
 * ThemeRoot — wraps the whole app with login check, theme, and light/dark mode.
 */

import { useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import App from "./App.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { isLoggedIn, logout, fetchCurrentUser } from "./utils/api";

const LIGHT = {
  primary: {
    main: "#145B6A",
    light: "#1E7A8C",
    dark: "#0D424D",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#9A7B2E",
    light: "#B8943F",
    dark: "#6B5010",
    contrastText: "#FFFFFF",
  },
  background: {
    default: "#EFF3F5",
    paper: "#FFFFFF",
  },
  text: {
    primary: "#1A2B32",
    secondary: "#5A6C75",
  },
  success: { main: "#2E7D52" },
  warning: { main: "#B8860B" },
  error: { main: "#C62828" },
  info: { main: "#1565C0" },
};

const DARK = {
  primary: {
    main: "#5BA899",
    light: "#7CC4B4",
    dark: "#3D8A7A",
    contrastText: "#0B1215",
  },
  secondary: {
    main: "#C4A86A",
    light: "#D4BC8A",
    dark: "#9A8248",
    contrastText: "#0B1215",
  },
  background: {
    default: "#0E1318",
    paper: "#171E24",
  },
  text: {
    primary: "#E8EEF1",
    secondary: "#9AABB4",
  },
  success: { main: "#6BBF8A" },
  warning: { main: "#D4A843" },
  error: { main: "#E57373" },
  info: { main: "#64B5F6" },
};

function buildPaletteTokens(colors, mode) {
  return {
    mode,
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    text: colors.text,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    divider: alpha(colors.text.primary, mode === "dark" ? 0.14 : 0.1),
    action: {
      hover: alpha(colors.primary.main, mode === "dark" ? 0.1 : 0.06),
      selected: alpha(colors.primary.main, mode === "dark" ? 0.16 : 0.1),
    },
  };
}

export default function ThemeRoot() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) return;

    fetchCurrentUser()
      .then(() => setLoggedIn(true))
      .catch(() => {
        logout();
        setLoggedIn(false);
      });
  }, []);

  const theme = useMemo(() => {
    const colors = darkMode ? DARK : LIGHT;
    const baseTheme = createTheme({
      palette: buildPaletteTokens(colors, darkMode ? "dark" : "light"),
      shape: {
        borderRadius: 12,
      },
      typography: {
        fontFamily: '"Manrope", "Segoe UI", sans-serif',
        h4: { fontWeight: 800, letterSpacing: "-0.02em" },
        h5: { fontWeight: 700, letterSpacing: "-0.01em" },
        h6: { fontWeight: 700 },
        button: { fontWeight: 700, textTransform: "none" },
      },
    });

    return createTheme(baseTheme, {
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              scrollbarColor: `${alpha(baseTheme.palette.text.secondary, 0.45)} transparent`,
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              boxShadow:
                baseTheme.palette.mode === "dark"
                  ? `0 1px 0 ${alpha(baseTheme.palette.common.white, 0.04)}, 0 10px 28px ${alpha(baseTheme.palette.common.black, 0.32)}`
                  : `0 1px 0 ${alpha(baseTheme.palette.primary.main, 0.05)}, 0 10px 28px ${alpha(baseTheme.palette.primary.dark, 0.07)}`,
              backgroundImage: "none",
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 12,
              border: "1px solid",
              borderColor: baseTheme.palette.divider,
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundImage: "none",
              backgroundColor: baseTheme.palette.background.paper,
              borderBottom: "1px solid",
              borderColor: baseTheme.palette.divider,
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              paddingInline: 18,
            },
            contained: {
              boxShadow: "none",
              "&:hover": {
                boxShadow:
                  baseTheme.palette.mode === "dark"
                    ? `0 6px 16px ${alpha(baseTheme.palette.common.black, 0.28)}`
                    : `0 6px 16px ${alpha(baseTheme.palette.primary.main, 0.18)}`,
              },
            },
            outlined: {
              borderWidth: 1.5,
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
            },
          },
        },
        MuiTextField: {
          defaultProps: {
            size: "small",
            fullWidth: true,
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: alpha(baseTheme.palette.primary.main, 0.45),
              },
            },
          },
        },
        MuiAlert: {
          styleOverrides: {
            root: {
              borderRadius: 10,
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              fontWeight: 600,
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
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: 8,
            },
          },
        },
      },
    });
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!loggedIn ? (
        <LoginPage onLoginSuccess={() => setLoggedIn(true)} />
      ) : (
        <App
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onLogout={handleLogout}
        />
      )}
    </ThemeProvider>
  );
}
