import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
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
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SpaIcon from "@mui/icons-material/Spa";
import ApartmentIcon from "@mui/icons-material/Apartment";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import AltRouteIcon from "@mui/icons-material/AltRoute";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import EditNoteIcon from "@mui/icons-material/EditNote";
import CompanyLocationSetupForm from "./admin-forms/CompanyLocationSetupForm";
import RoomForm from "./admin-forms/RoomForm";
import StrainForm from "./admin-forms/StrainForm";
import CreateMomsForm from "./admin-forms/CreateMomsForm";
import EditBatchForm from "./admin-forms/EditBatchForm";
import BatchForm from "./BatchForm";
import DestroyPlantsForm from "./admin-forms/DestroyPlantsForm";

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
    key: "editBatch",
    title: "Edit Batch",
    description:
      "Manually adjust batch dates, lifecycle stage, plant totals, and demo overrides.",
    category: "Batch Operations",
    icon: EditNoteIcon,
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

function AdminWorkflowNav({ activeWorkflowKey, onSelect, workflowsByCategory }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        overflow: "hidden",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxShadow: "none",
      }}
    >
      <Box sx={{ px: 1.75, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Workflows
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Select a task to open its form
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", py: 1, px: 1 }}>
        {Object.entries(workflowsByCategory).map(
          ([categoryName, categoryWorkflows], categoryIndex) => (
            <Box key={categoryName} sx={{ mb: categoryIndex === 0 ? 0.5 : 1.5 }}>
              <Typography
                variant="overline"
                sx={{
                  display: "block",
                  px: 1,
                  py: 0.75,
                  color: "text.secondary",
                  letterSpacing: 0.75,
                  fontSize: "0.68rem",
                }}
              >
                {categoryName}
              </Typography>

              <List dense disablePadding>
                {categoryWorkflows.map((workflow) => {
                  const Icon = workflow.icon;
                  const selected = activeWorkflowKey === workflow.key;

                  return (
                    <ListItemButton
                      key={workflow.key}
                      selected={selected}
                      onClick={() => onSelect(workflow.key)}
                      sx={(theme) => ({
                        borderRadius: 1.5,
                        mb: 0.35,
                        py: 0.85,
                        pl: 1.25,
                        border: "1px solid",
                        borderColor: selected
                          ? alpha(theme.palette.primary.main, 0.35)
                          : "transparent",
                        bgcolor: selected
                          ? alpha(theme.palette.primary.main, 0.1)
                          : "transparent",
                        "&:hover": {
                          bgcolor: selected
                            ? alpha(theme.palette.primary.main, 0.14)
                            : alpha(theme.palette.action.hover, 0.45),
                        },
                        "&.Mui-selected": {
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                        },
                        "&.Mui-selected:hover": {
                          bgcolor: alpha(theme.palette.primary.main, 0.14),
                        },
                      })}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 32,
                          color: selected ? "primary.main" : "text.secondary",
                        }}
                      >
                        <Icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={workflow.title}
                        primaryTypographyProps={{
                          variant: "body2",
                          sx: { fontWeight: selected ? 700 : 500, lineHeight: 1.35 },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          ),
        )}
      </Box>
    </Paper>
  );
}

export default function AdminPanel() {
  const [activeWorkflowKey, setActiveWorkflowKey] = useState(ADMIN_WORKFLOWS[0].key);

  const workflowsByCategory = useMemo(
    () =>
      ADMIN_WORKFLOWS.reduce((acc, workflow) => {
        const group = acc[workflow.category] || [];
        group.push(workflow);
        acc[workflow.category] = group;
        return acc;
      }, {}),
    [],
  );

  const activeWorkflow =
    ADMIN_WORKFLOWS.find((workflow) => workflow.key === activeWorkflowKey) ||
    ADMIN_WORKFLOWS[0];

  const ActiveIcon = activeWorkflow.icon;

  function renderActiveForm() {
    if (activeWorkflow.key === "strain") return <StrainForm />;
    if (activeWorkflow.key === "orgSetup") return <CompanyLocationSetupForm />;
    if (activeWorkflow.key === "room") return <RoomForm section="add" />;
    if (activeWorkflow.key === "batch") return <BatchForm />;
    if (activeWorkflow.key === "editBatch") return <EditBatchForm />;
    if (activeWorkflow.key === "assign") return <RoomForm section="assign" />;
    if (activeWorkflow.key === "destroyPlants") return <DestroyPlantsForm />;
    if (activeWorkflow.key === "createMoms") return <CreateMomsForm />;
    return null;
  }

  return (
    <Box sx={{ maxWidth: 1320, mx: "auto", width: "100%" }}>
      <Stack spacing={2}>
        <Paper
          variant="outlined"
          sx={(theme) => ({
            px: { xs: 2, md: 2.5 },
            py: { xs: 1.75, md: 2 },
            borderRadius: 2.5,
            boxShadow: "none",
            background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.98)})`,
          })}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar
              sx={(theme) => ({
                width: 44,
                height: 44,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                color: "primary.main",
              })}
            >
              <AdminPanelSettingsIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Admin Center
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage core records, batches, and plant operations.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Grid container spacing={2} alignItems="stretch">
          <Grid
            size={{ xs: 12, md: 4, lg: 3.5 }}
            sx={{
              position: { md: "sticky" },
              top: { md: 12 },
              alignSelf: { md: "flex-start" },
              maxHeight: { md: "calc(100vh - 200px)" },
            }}
          >
            <AdminWorkflowNav
              activeWorkflowKey={activeWorkflowKey}
              onSelect={setActiveWorkflowKey}
              workflowsByCategory={workflowsByCategory}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 8, lg: 8.5 }}>
            <Paper
              variant="outlined"
              sx={(theme) => ({
                borderRadius: 2.5,
                overflow: "hidden",
                boxShadow: "none",
                borderColor: alpha(theme.palette.divider, 0.9),
              })}
            >
              <Box
                sx={(theme) => ({
                  px: { xs: 2, md: 2.5 },
                  py: 2,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.background.paper, 0.98)})`,
                })}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar
                    sx={(theme) => ({
                      width: 40,
                      height: 40,
                      bgcolor: alpha(theme.palette.primary.main, 0.14),
                      color: "primary.main",
                    })}
                  >
                    <ActiveIcon fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                      {activeWorkflow.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {activeWorkflow.description}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ px: { xs: 2, md: 2.5 }, py: { xs: 2, md: 2.5 } }}>
                {renderActiveForm()}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
