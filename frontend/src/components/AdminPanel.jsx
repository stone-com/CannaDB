import { useState } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import SpaIcon from "@mui/icons-material/Spa";
import ApartmentIcon from "@mui/icons-material/Apartment";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import CompanyLocationSetupForm from "./admin-forms/CompanyLocationSetupForm";
import RoomForm from "./admin-forms/RoomForm";
import StrainForm from "./admin-forms/StrainForm";
import CreateMomsForm from "./admin-forms/CreateMomsForm";
import BatchForm from "./BatchForm";
import DestroyPlantsForm from "./admin-forms/DestroyPlantsForm";

// Available admin workflows grouped into category-based navigation.
// This configuration drives both left navigation and right-side panel details.
const ADMIN_WORKFLOWS = [
  {
    key: "strain",
    title: "Edit Strains",
    description: "Add, edit, or remove strain profiles and status metadata.",
    category: "Core Records",
    icon: SpaIcon,
  },
  {
    key: "orgSetup",
    title: "Company & Location Setup",
    description:
      "Create a company, then immediately add one or more locations in the same flow.",
    category: "Core Records",
    icon: ApartmentIcon,
  },
  {
    key: "room",
    title: "Edit Rooms",
    description:
      "Add, edit, or remove rooms with location, type, and capacity settings.",
    category: "Core Records",
    icon: MeetingRoomIcon,
  },
  {
    key: "batch",
    title: "Create Batch",
    description:
      "Create a new batch with clone/harvest dates and initial plant counts.",
    category: "Batch Operations",
    icon: Inventory2Icon,
  },
  {
    key: "assign",
    title: "Move/Transplant Plants",
    description:
      "Move or split plants across rooms and advance their growth stage.",
    category: "Batch Operations",
    icon: AltRouteIcon,
  },
  {
    key: "destroyPlants",
    title: "Destroy Plants",
    description:
      "Remove selected strain plants from a batch and persist the reduction.",
    category: "Batch Operations",
    icon: DeleteSweepIcon,
  },
  {
    key: "createMoms",
    title: "Create Moms",
    description:
      "Create a new mom batch from production plants for propagation.",
    category: "Batch Operations",
    icon: ContentCutIcon,
  },
];

// Admin workspace that switches between operational forms.
export default function AdminPanel() {
  // Tracks which workflow button is selected in the left navigation list.
  const [activeWorkflowKey, setActiveWorkflowKey] = useState(
    ADMIN_WORKFLOWS[0].key,
  );

  // Build a category -> workflows map for grouped rendering.
  const workflowsByCategory = ADMIN_WORKFLOWS.reduce((acc, workflow) => {
    const group = acc[workflow.category] || [];
    group.push(workflow);
    acc[workflow.category] = group;
    return acc;
  }, {});

  // Read currently selected workflow object for icon/title/description rendering.
  const activeWorkflow =
    ADMIN_WORKFLOWS.find((workflow) => workflow.key === activeWorkflowKey) ||
    ADMIN_WORKFLOWS[0];

  // Render the form that belongs to the currently selected workflow.
  function renderActiveForm() {
    // Each condition picks one React component to render in the right panel.
    if (activeWorkflow.key === "strain") return <StrainForm embedded />;
    if (activeWorkflow.key === "orgSetup") {
      return <CompanyLocationSetupForm embedded />;
    }
    if (activeWorkflow.key === "room")
      return <RoomForm embedded section="add" />;
    if (activeWorkflow.key === "batch") return <BatchForm />;
    if (activeWorkflow.key === "assign") {
      return <RoomForm embedded section="assign" />;
    }
    if (activeWorkflow.key === "destroyPlants") {
      return <DestroyPlantsForm embedded />;
    }
    if (activeWorkflow.key === "createMoms") {
      return <CreateMomsForm embedded />;
    }
    return null;
  }

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <Stack spacing={2.5}>
        {/* Intro banner uses Paper as a low-emphasis container with custom background. */}
        <Paper
          elevation={0}
          sx={(theme) => ({
            p: { xs: 2, md: 2.75 },
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: "divider",
            background: `linear-gradient(105deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.06)}, ${alpha(theme.palette.background.paper, 0.96)})`,
          })}
        >
          <Stack spacing={0.5}>
            <Typography variant="h4">Admin Operations Center</Typography>
          </Stack>
        </Paper>

        <Grid container spacing={2}>
          {/* Grid gives a responsive 2-column layout: nav left, content right. */}
          <Grid size={{ xs: 12, md: 4, lg: 3 }}>
            {/* Left column: workflow list grouped by category. */}
            <Card
              sx={{
                height: "100%",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CardContent sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  {/* Render each category heading with its workflow buttons underneath. */}
                  {Object.entries(workflowsByCategory).map(
                    ([categoryName, categoryWorkflows]) => (
                      <Box key={categoryName}>
                        <Typography
                          variant="overline"
                          sx={{
                            px: 1,
                            color: "text.secondary",
                            letterSpacing: 0.7,
                          }}
                        >
                          {categoryName}
                        </Typography>
                        <List dense disablePadding>
                          {categoryWorkflows.map((workflow) => {
                            const Icon = workflow.icon;
                            return (
                              <ListItemButton
                                key={workflow.key}
                                selected={activeWorkflowKey === workflow.key}
                                // Update selection so right panel swaps to matching form.
                                onClick={() =>
                                  setActiveWorkflowKey(workflow.key)
                                }
                                sx={{ borderRadius: 1.25, mb: 0.25 }}
                              >
                                <ListItemIcon sx={{ minWidth: 34 }}>
                                  <Icon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={workflow.title}
                                  primaryTypographyProps={{ variant: "body2" }}
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      </Box>
                    ),
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8, lg: 9 }}>
            {/* Right column: details header + active form content. */}
            <Card
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={2}>
                  {/* Header row shows the selected workflow icon + title/description. */}
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar
                      sx={{
                        bgcolor: "primary.main",
                        width: 36,
                        height: 36,
                      }}
                    >
                      <activeWorkflow.icon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="h5">
                        {activeWorkflow.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activeWorkflow.description}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      color="primary"
                      label={activeWorkflow.category}
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Complete fields in order, then submit to apply changes.
                    </Typography>
                  </Stack>

                  <Divider />

                  <Box sx={{ pt: 0.5 }}>{renderActiveForm()}</Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
