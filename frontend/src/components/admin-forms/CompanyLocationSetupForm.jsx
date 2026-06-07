import { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ApartmentIcon from "@mui/icons-material/Apartment";
import PlaceIcon from "@mui/icons-material/Place";
import EditLocationAltIcon from "@mui/icons-material/EditLocationAlt";
import CompanyForm from "./CompanyForm";
import LocationForm from "./LocationForm";
import EditLocationForm from "./EditLocationForm";

const ORG_ACTIONS = [
  {
    key: "addCompany",
    title: "Add Company",
    subtitle: "Create a new company profile for your organization.",
    icon: ApartmentIcon,
  },
  {
    key: "addLocation",
    title: "Add Location",
    subtitle: "Create a new location under an existing company.",
    icon: PlaceIcon,
  },
  {
    key: "editLocation",
    title: "Edit Location",
    subtitle: "Update company assignment, nickname, or address.",
    icon: EditLocationAltIcon,
  },
];

// Consolidated organization setup workspace with action-based navigation.
export default function CompanyLocationSetupForm({ embedded }) {
  const [activeAction, setActiveAction] = useState(ORG_ACTIONS[0].key);

  const activeActionIndex = useMemo(
    () => ORG_ACTIONS.findIndex((action) => action.key === activeAction),
    [activeAction],
  );

  const content = (
    <Stack spacing={2.25}>
      <Stack spacing={0.5}>
        <Typography variant="h6">Organization Setup</Typography>
        <Typography variant="body2" color="text.secondary">
          Choose an action below to manage companies and locations.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {ORG_ACTIONS.map((action) => {
          const Icon = action.icon;
          const selected = action.key === activeAction;
          return (
            <Card
              key={action.key}
              variant="outlined"
              sx={(theme) => ({
                borderRadius: 1.75,
                borderColor: selected ? "primary.main" : "divider",
                backgroundColor: selected
                  ? theme.palette.action.selected
                  : "background.paper",
              })}
            >
              <CardActionArea onClick={() => setActiveAction(action.key)}>
                <CardContent sx={{ p: 1.5 }}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Icon fontSize="small" />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {action.title}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {action.subtitle}
                    </Typography>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      <Tabs
        value={Math.max(activeActionIndex, 0)}
        onChange={(_, tabIndex) => {
          const next = ORG_ACTIONS[tabIndex];
          if (next) setActiveAction(next.key);
        }}
        variant="fullWidth"
      >
        <Tab label="Add Company" />
        <Tab label="Add Location" />
        <Tab label="Edit Location" />
      </Tabs>

      <Box>
        {activeAction === "addCompany" && <CompanyForm embedded />}
        {activeAction === "addLocation" && <LocationForm embedded />}
        {activeAction === "editLocation" && <EditLocationForm embedded />}
      </Box>
    </Stack>
  );

  if (embedded) return content;

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Company and Location Setup</Typography>
      {content}
    </Stack>
  );
}
