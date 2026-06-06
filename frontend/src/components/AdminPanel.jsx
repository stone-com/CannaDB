import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CompanyForm from "./admin-forms/CompanyForm";
import LocationForm from "./admin-forms/LocationForm";
import RoomForm from "./admin-forms/RoomForm";
import StrainForm from "./admin-forms/StrainForm";
import CreateMomsForm from "./admin-forms/CreateMomsForm";

const ADMIN_CARDS = [
  {
    key: "strain",
    label: "Add Strain",
    description: "Create a new strain record",
  },
  {
    key: "company",
    label: "Add Company",
    description: "Register a new company",
  },
  {
    key: "location",
    label: "Add Location",
    description: "Add a grow location",
  },
  { key: "room", label: "Add Room", description: "Create a new grow room" },
  {
    key: "assign",
    label: "Assign Batch to Room",
    description: "Assign rooms, split plants, and advance stage",
  },
  {
    key: "createMoms",
    label: "Create Moms",
    description: "Cut plants from production into a mom batch",
  },
];

export default function AdminPanel() {
  const [activeCard, setActiveCard] = useState(null);

  function handleCardClick(key) {
    setActiveCard((prev) => (prev === key ? null : key));
  }

  function handleBack() {
    setActiveCard(null);
  }

  if (activeCard) {
    return (
      <Stack spacing={2}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
            Back
          </Button>
        </Box>

        <Card>
          <CardContent>
            {activeCard === "strain" && <StrainForm embedded />}
            {activeCard === "company" && <CompanyForm embedded />}
            {activeCard === "location" && <LocationForm embedded />}
            {activeCard === "room" && <RoomForm embedded section="add" />}
            {activeCard === "assign" && <RoomForm embedded section="assign" />}
            {activeCard === "createMoms" && <CreateMomsForm embedded />}
          </CardContent>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4">Admin Controls</Typography>
        <Typography color="text.secondary">
          Select a workflow to open a structured admin form.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {ADMIN_CARDS.map((card) => (
          <Grid key={card.key} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card>
              <CardActionArea onClick={() => handleCardClick(card.key)}>
                <CardContent>
                  <Typography variant="h6">{card.label}</Typography>
                  <Typography color="text.secondary" variant="body2">
                    {card.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
