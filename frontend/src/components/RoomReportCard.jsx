import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';

function RoomReportCard({ rooms = [], roomAssignments = [], onClick }) {
  const activeAssignments = Array.isArray(roomAssignments)
    ? roomAssignments.filter((assignment) => assignment?.active !== false)
    : [];

  const totalPlants = activeAssignments.reduce((sum, assignment) => {
  const plants = Array.isArray(assignment?.assignedPlants)
      ? assignment.assignedPlants
      : [];
    return (
      sum +
      plants.reduce((inner, plant) => inner + (Number(plant?.count) || 0), 0)
    );
  }, 0);

  const roomTypeSummary = {
    flower: { rooms: 0, plants: 0 },
    veg: { rooms: 0, plants: 0 },
    clone: { rooms: 0, plants: 0 },
    mom: { rooms: 0, plants: 0 },
  };

  const roomLookup = new Map(
    (Array.isArray(rooms) ? rooms : []).map((room) => [
      String(room?._id || room?.id || ""),
      room,
    ])
  );

  (Array.isArray(rooms) ? rooms : []).forEach((room) => {
    const type = String(room?.type || "")
      .trim()
      .toLowerCase();

    if (type === "flower") {
      roomTypeSummary.flower.rooms += 1;
    } else if (type === "veg") {
      roomTypeSummary.veg.rooms += 1;
    } else if (type === "clone") {
      roomTypeSummary.clone.rooms += 1;
    } else if (type === "mom") {
      roomTypeSummary.mom.rooms += 1;
    }
  });

  activeAssignments.forEach((assignment) => {
    const roomId = assignment?.roomId;
    const room =
      roomId && typeof roomId === "object"
        ? roomId
        : roomLookup.get(String(roomId || ""));
    const type = String(room?.type || "")
      .trim()
      .toLowerCase();

    const plants = Array.isArray(assignment?.assignedPlants)
      ? assignment.assignedPlants.reduce(
          (sum, plant) => sum + (Number(plant?.count) || 0),
          0
        )
      : 0;

    if (type === "flower") {
      roomTypeSummary.flower.plants += plants;
    } else if (type === "veg") {
      roomTypeSummary.veg.plants += plants;
    } else if (type === "clone") {
      roomTypeSummary.clone.plants += plants;
    } else if (type === "mom") {
      roomTypeSummary.mom.plants += plants;
    }
  });

  const summaryRows = [
    { label: "Flower", key: "flower" },
    { label: "Veg", key: "veg" },
    { label: "Clone", key: "clone" },
    { label: "Mom", key: "mom" },
  ];

  return (
    <Card variant="outlined"
      sx={{
        borderColor: "primary.main",
        background: "secondary.main"
      }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">Room Report</Typography>
          <Typography variant="body2" color="text.secondary">
            Overview of rooms and plants in the current workspace.
          </Typography>
          <Typography variant="body1">
            Rooms: <strong>{rooms.length}</strong>
          </Typography>
          <Typography variant="body1">
            Total plants: <strong>{totalPlants}</strong>
          </Typography>

          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {summaryRows.map((row) => {
              const data = roomTypeSummary[row.key];
              return (
                <Typography key={row.key} variant="body2">
                  <strong>{row.label}:</strong> {data.rooms} rooms • {data.plants} plants
                </Typography>
              );
            })}
          </Stack>
        </Stack>
        <Button variant="contained" onClick={onClick} sx={{ mt: 1.5 }}>
          <MeetingRoomIcon sx={{ mr: 1 }} />
          View Rooms
        </Button>
      </CardContent>
    </Card>
  );
}

export default RoomReportCard;