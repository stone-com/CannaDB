/**
 * ThemeRoot — wraps the whole app with login check, theme, and light/dark mode.
 */

import { useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { amber, blueGrey, cyan, green, grey, teal } from "@mui/material/colors";
import App from "./App.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { isLoggedIn, logout, fetchCurrentUser } from "./utils/api";

export default function ThemeRoot() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [darkMode, setDarkMode] = useState(false);

  // On page load, verify the saved token is still valid.
  useEffect(() => {
    if (!isLoggedIn()) return;

    fetchCurrentUser()
      .then(() => setLoggedIn(true))
      .catch(() => {
        logout();
        setLoggedIn(false);
      });
  }, []);

  // Build the MUI theme object (colors, fonts, etc.) based on light/dark mode.
  const theme = useMemo(
    () =>
      createTheme({
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
        shape: {
          borderRadius: 14,
        },
        typography: {
          fontFamily: '"Manrope", "Segoe UI", sans-serif',
          h4: { fontWeight: 800, letterSpacing: "-0.02em" },
          h5: { fontWeight: 700, letterSpacing: "-0.01em" },
          h6: { fontWeight: 700 },
          button: { fontWeight: 700, textTransform: "none" },
        },
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

  // Clear the saved token and return to the login screen.
  const handleLogout = () => {
    logout();
    setLoggedIn(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!loggedIn ? (
        /* Login screen when user is not logged in */
        <LoginPage onLoginSuccess={() => setLoggedIn(true)} />
      ) : (
        /* Main app after successful login */
        <App
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onLogout={handleLogout}
        />
      )}
    </ThemeProvider>
  );
}
