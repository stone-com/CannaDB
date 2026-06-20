/**
 * Room Viewer window — overview grid first, detail view when you click a room.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { alpha } from "@mui/material/styles";
import { buildRoomOverview, stageColor } from "../utils/roomOverviewHelpers";
import RoomViewer from "./RoomViewer";

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

// One room card in the overview — click to open details.
function RoomCard({ card, onSelect }) {
  const { room, strainLines, totalPlants, batchNumber, lifecycleStage, headerDate } = card;
  const empty = strainLines.length === 0;

  return (
    <Paper
      elevation={0}
      onClick={() => onSelect(room._id)}
      sx={(theme) => ({
        flex: "1 1 150px",
        maxWidth: { xs: "100%", sm: 220 },
        minWidth: 0,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        overflow: "hidden",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.12)}`,
        },
      })}
    >
      <Box
        sx={(theme) => ({
          px: 1.25,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.primary.main, 0.08),
        })}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {room.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {room.type || "Room"}
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          <Chip
            size="small"
            label={batchNumber || "Empty"}
            color={batchNumber ? stageColor(lifecycleStage) : "default"}
            variant="outlined"
            sx={{ height: 22, fontSize: "0.7rem" }}
          />
          {headerDate && (
            <Chip
              size="small"
              label={shortDate(headerDate)}
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
          )}
        </Stack>
      </Box>

      <Stack spacing={0} sx={{ minHeight: 120 }}>
        {empty ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 1.25, fontStyle: "italic" }}>
            No plants assigned
          </Typography>
        ) : (
          strainLines.map((line) => (
            <Box
              key={line.name}
              sx={(theme) => {
                const color = theme.palette[stageColor(lifecycleStage)]?.main
                  || theme.palette.success.main;
                return {
                  px: 1.25,
                  py: 0.6,
                  borderBottom: "1px solid",
                  borderColor: alpha(theme.palette.divider, 0.7),
                  bgcolor: alpha(color, 0.12),
                };
              }}
            >
              <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                {line.name} - {line.count}
              </Typography>
            </Box>
          ))
        )}
      </Stack>

      {!empty && (
        <Box sx={{ px: 1.25, py: 0.75, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary">
            {totalPlants} plants total
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default function RoomViewerPanel({ rooms, roomAssignments }) {
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const locations = useMemo(
    () => buildRoomOverview(rooms, roomAssignments),
    [rooms, roomAssignments],
  );

  // Go back to overview if the selected room was deleted.
  useEffect(() => {
    if (!selectedRoomId) return;
    const exists = (rooms || []).some((room) => String(room._id) === String(selectedRoomId));
    if (!exists) setSelectedRoomId(null);
  }, [rooms, selectedRoomId]);

  if (selectedRoomId) {
    return (
      <Stack spacing={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          onClick={() => setSelectedRoomId(null)}
          sx={{ alignSelf: "flex-start" }}
        >
          Back to Room Overview
        </Button>
        <RoomViewer
          rooms={rooms}
          roomAssignments={roomAssignments}
          initialRoomId={selectedRoomId}
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ width: "100%", minWidth: 0 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Room Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All rooms by location. Click a room for full details.
        </Typography>
      </Stack>

      {locations.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No rooms found yet.
        </Typography>
      )}

      {locations.map((location) => (
        <Box
          key={location.locationId}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.5,
            width: "100%",
            minWidth: 0,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: { xs: "100%", sm: 112 },
              flexShrink: 0,
              px: 1.5,
              py: 1.25,
              borderRadius: 1.5,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {location.locationName}
            </Typography>
          </Paper>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, flex: 1, minWidth: 0 }}>
            {location.rooms.map((card) => (
              <RoomCard
                key={card.room._id}
                card={card}
                onSelect={setSelectedRoomId}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
