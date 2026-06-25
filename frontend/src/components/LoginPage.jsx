/**
 * LoginPage — sign-in screen shown before the main app loads.
 */

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";
import { alpha } from "@mui/material/styles";
import { login } from "../utils/api";

const DEMO_ACCOUNTS = [
  {
    label: "Mount Baker (default)",
    email: "admin@demo.local",
    password: "demo1234",
  },
  {
    label: "Green Valley",
    email: "ops@greenvalley.local",
    password: "green1234",
  },
];

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0].password);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Click a demo card to fill email/password fields.
  const applyDemoAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  // POST credentials to the API; parent shows the dashboard on success.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      onLoginSuccess();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={(theme) => ({
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.secondary.main, 0.08)}, ${theme.palette.background.default})`,
      })}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            {/* Brand + short product description */}
            <Stack spacing={1} alignItems="center" textAlign="center">
              <Box
                sx={(theme) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: "primary.main",
                })}
              >
                <InsightsIcon />
              </Box>
              <Stack spacing={0.5}>
                <Typography variant="h5">CannaDB</Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in to your organization&apos;s inventory workspace.
                </Typography>
              </Stack>
            </Stack>

            {/* Email + password inputs */}
            <Stack spacing={1.5}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                fullWidth
              />

              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                fullWidth
              />
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Button
              variant="contained"
              type="submit"
              disabled={loading}
              fullWidth
              size="large"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <Divider />

            {/* Demo shortcuts for alpha testing */}
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Alpha demo accounts
              </Typography>

              {DEMO_ACCOUNTS.map((account) => (
                <Box
                  key={account.email}
                  role="button"
                  tabIndex={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    cursor: "pointer",
                    transition: "border-color 150ms ease, background-color 150ms ease",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: "action.hover",
                    },
                  }}
                  onClick={() => applyDemoAccount(account)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      applyDemoAccount(account);
                    }
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography variant="subtitle2">{account.label}</Typography>
                    <Chip size="small" label="Use" variant="outlined" />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {account.email}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
