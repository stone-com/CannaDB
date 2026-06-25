/**
 * LoginPage — email/password form shown before the main app loads.
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

  // Fills the form when user clicks a demo account card.
  const applyDemoAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  // Sends login request and tells the parent to show the main app.
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
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            {/* Title and short description */}
            <Stack spacing={0.5}>
              <Typography variant="h5">CannaDB Login</Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to access your organization&apos;s inventory data.
              </Typography>
            </Stack>

            {/* Email and password inputs */}
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

            {error && <Alert severity="error">{error}</Alert>}

            <Button variant="contained" type="submit" disabled={loading} fullWidth>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <Divider />

            {/* Demo account shortcuts — click to fill the form */}
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                Demo accounts — click to fill the form
              </Typography>

              {DEMO_ACCOUNTS.map((account) => (
                <Box
                  key={account.email}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    cursor: "pointer",
                    "&:hover": {
                      borderColor: "primary.main",
                      bgcolor: "action.hover",
                    },
                  }}
                  onClick={() => applyDemoAccount(account)}
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
                  <Typography variant="body2" color="text.secondary">
                    Password: {account.password}
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
