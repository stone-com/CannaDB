import { useMemo } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import CompostIcon from '@mui/icons-material/Compost';
import YardIcon from '@mui/icons-material/Yard';
import { formatDate } from "../utils/formatDate";

function UpcomingHarvestCard({ batches = [], onStartHarvest }) {
  const upcomingBatch = useMemo(() => {
    if (!Array.isArray(batches)) return null;

    return (
      [...batches]
        .filter((batch) => !batch.harvestId && batch.harvestDate)
        .sort(
          (a, b) => new Date(a.harvestDate) - new Date(b.harvestDate),
        )[0] || null
    );
  }, [batches]);

  const plannedPlants = useMemo(() => {
    if (!upcomingBatch?.rooms) return [];

    const plantMap = new Map();

    upcomingBatch.rooms.forEach((room) => {
      (room.plants || []).forEach((plant) => {
        const strainName = plant.strainId?.name || "Unknown strain";
        const count = Number(plant.count) || 0;
        const existing = plantMap.get(strainName) || { name: strainName, count: 0 };
        existing.count += count;
        plantMap.set(strainName, existing);
      });
    });

    return Array.from(plantMap.values()).sort((a, b) => b.count - a.count);
  }, [upcomingBatch]);

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: "primary.main",
        background: "secondary.main"
          
      }}
    >
      <CardContent>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Stack spacing={1} sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CompostIcon color="primary" />
              <Typography variant="h6">Upcoming Harvest</Typography>
            </Stack>

            {upcomingBatch ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  Scheduled for {formatDate(upcomingBatch.harvestDate)}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Batch {upcomingBatch.batchNumber}
                </Typography>
                <Typography variant="body1">
                  Plants to harvest:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {plannedPlants.length > 0 ? (
                    plannedPlants.map((plant) => (
                      <Chip
                        key={plant.name}
                        label={`${plant.name} × ${plant.count}`}
                        color="primary"
                        variant="outlined"
                      />
                    ))
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No plant assignments have been added for this batch yet.
                    </Typography>
                  )}
                </Stack>
              </>
            ) : (
              <Typography variant="body1" color="text.secondary">
                No upcoming harvest has been scheduled yet.
              </Typography>
            )}
          </Stack>

          <Stack spacing={1.5} sx={{ minWidth: { xs: "100%", md: 220 } }}>
            <Divider sx={{ display: { xs: "block", md: "none" } }} />
            <Button variant="contained" size="large" onClick={onStartHarvest}>
              <YardIcon sx={{ mr: 1 }} />
              Start Harvest
            </Button>
            <Typography variant="body2" color="text.secondary">
              Opens the add harvest workflow for the next planned batch.
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default UpcomingHarvestCard;
