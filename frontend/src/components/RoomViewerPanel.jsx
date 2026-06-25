/**
 * RoomViewerPanel — location overview grid, then room detail on click.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PlaceIcon from "@mui/icons-material/Place";
import SearchIcon from "@mui/icons-material/Search";
import { alpha } from "@mui/material/styles";
import {
  buildRoomOverview,
  roomTypeColor,
  stageColor,
} from "../utils/roomOverviewHelpers";
import StatCard from "./ui/StatCard";
import RoomViewer from "./RoomViewer";

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// One clickable room tile in the overview grid.
function RoomOverviewCard({ card, onSelect }) {
  const {
    room,
    strainLines,
    totalPlants,
    batchChipLabel,
    batchCount,
    lifecycleStage,
    harvestDate,
    assignmentStartedAt,
  } = card;
  const empty = strainLines.length === 0;
  const topStrains = strainLines.slice(0, 4);
  const extraStrainCount = Math.max(0, strainLines.length - topStrains.length);
  const isFlowerRoom = String(room.type || "").toLowerCase() === "flower";

  const countColumnSx = {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    minWidth: 40,
    textAlign: "right",
  };

  return (
    <Paper
      variant="outlined"
      onClick={() => onSelect(room._id)}
      sx={(theme) => ({
        height: "100%",
        minHeight: 208,
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
        ...(empty
          ? {
              borderStyle: "dashed",
              bgcolor: alpha(theme.palette.action.hover, 0.25),
            }
          : {}),
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.12)}`,
          transform: "translateY(-1px)",
        },
      })}
    >
      <Box sx={{ px: 2, pt: 2, pb: 1.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.25, pr: 0.5 }}>
            {room.name}
          </Typography>
          <Chip
            size="small"
            label={room.type || "Room"}
            color={roomTypeColor(room.type)}
            variant="outlined"
            sx={{ height: 22, flexShrink: 0, fontSize: "0.7rem" }}
          />
        </Stack>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
          <Chip
            size="small"
            label={batchChipLabel || "Empty"}
            color={batchCount === 1 ? stageColor(lifecycleStage) : "default"}
            variant={empty ? "outlined" : "filled"}
            sx={{ height: 22, fontSize: "0.7rem" }}
          />
          {isFlowerRoom && harvestDate ? (
            <Chip
              size="small"
              label={`Harvest on: ${shortDate(harvestDate)}`}
              color="warning"
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
          ) : null}
          {!isFlowerRoom && assignmentStartedAt ? (
            <Chip
              size="small"
              label={`Since ${shortDate(assignmentStartedAt)}`}
              variant="outlined"
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
          ) : null}
        </Stack>
      </Box>

      <Box
        sx={(theme) => ({
          flex: 1,
          px: 2,
          py: empty ? 2 : 1.25,
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: empty
            ? "transparent"
            : alpha(theme.palette.background.default, 0.45),
          display: "flex",
          flexDirection: "column",
          justifyContent: empty ? "center" : "flex-start",
        })}
      >
        {empty ? (
          <Typography
            variant="body2"
            color="text.secondary"
            fontStyle="italic"
            textAlign="center"
          >
            No active batch
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                columnGap: 1,
                mb: 0.75,
              }}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ lineHeight: 1.2, letterSpacing: 0.6, fontSize: "0.65rem" }}
              >
                Strain
              </Typography>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{
                  ...countColumnSx,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: 0.6,
                  fontSize: "0.65rem",
                }}
              >
                Plants
              </Typography>
            </Box>

            <Stack spacing={0.625} sx={{ width: "100%" }}>
              {topStrains.map((line) => (
                <Box
                  key={line.name}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    columnGap: 1,
                    alignItems: "center",
                    minHeight: 22,
                  }}
                >
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontSize: "0.8125rem", color: "text.primary" }}
                  >
                    {line.name}
                  </Typography>
                  <Typography variant="body2" sx={{ ...countColumnSx, fontSize: "0.8125rem" }}>
                    {line.count.toLocaleString()}
                  </Typography>
                </Box>
              ))}
              {extraStrainCount > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ pt: 0.25 }}>
                  +{extraStrainCount} more strain{extraStrainCount === 1 ? "" : "s"}
                </Typography>
              ) : null}
            </Stack>
          </>
        )}
      </Box>

      <Box
        sx={(theme) => ({
          px: 2,
          py: 1.25,
          bgcolor: alpha(theme.palette.primary.main, empty ? 0 : 0.04),
        })}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            columnGap: 1,
            alignItems: "baseline",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Total plants
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              ...countColumnSx,
              color: empty ? "text.secondary" : "primary.main",
            }}
          >
            {empty ? "—" : totalPlants.toLocaleString()}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

function roomMatchesSearch(card, locationName, query) {
  if (!query) return true;

  const room = card.room;
  const strainText = card.strainLines.map((line) => line.name).join(" ");
  const searchBlob = [
    room.name,
    locationName,
    room.type,
    card.batchChipLabel,
    card.lifecycleStage,
    strainText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchBlob.includes(query);
}

function formatRoomTypeLabel(type) {
  if (!type) return "Unknown";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function FilterCheckboxRow({ label, checked, onChange, count, accentColor }) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          size="small"
          checked={checked}
          onChange={onChange}
          color="primary"
          sx={{ py: 0.25, alignSelf: "flex-start" }}
        />
      }
      label={
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ width: "100%", minWidth: 0, py: 0.15 }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            {accentColor ? (
              <Box
                sx={(theme) => ({
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  bgcolor: theme.palette[accentColor]?.main || theme.palette.grey[500],
                })}
              />
            ) : null}
            <Typography variant="body2" noWrap sx={{ fontWeight: checked ? 600 : 400 }}>
              {label}
            </Typography>
          </Stack>
          {count != null ? (
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {count}
            </Typography>
          ) : null}
        </Stack>
      }
      sx={{
        mx: 0,
        width: "100%",
        alignItems: "flex-start",
        "& .MuiFormControlLabel-label": { width: "100%", mt: 0.15 },
      }}
    />
  );
}

function RoomOverviewFilters({
  overviewStats,
  searchQuery,
  onSearchChange,
  selectedLocationIds,
  onToggleLocation,
  selectedRoomTypes,
  onToggleRoomType,
  filterOptions,
  locationCounts,
  typeCounts,
  totalRoomCount,
  hasActiveFilters,
  onClearFilters,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1.25, py: 1.1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: "block", mb: 0.75, letterSpacing: 0.8, lineHeight: 1.2 }}
        >
          Summary
        </Typography>
        <Grid container spacing={0.75}>
          <Grid size={6}>
            <StatCard compact label="Locations" value={overviewStats.locationCount} />
          </Grid>
          <Grid size={6}>
            <StatCard compact label="Rooms" value={overviewStats.roomCount} />
          </Grid>
          <Grid size={6}>
            <StatCard compact label="Occupied" value={overviewStats.roomsWithPlants} />
          </Grid>
          <Grid size={6}>
            <StatCard
              compact
              label="Live plants"
              value={overviewStats.totalPlants.toLocaleString()}
            />
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          Search & filters
        </Typography>
        <TextField
          size="small"
          fullWidth
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search rooms, strains…"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
        <Stack spacing={2}>
          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5, letterSpacing: 0.8 }}
            >
              Location
            </Typography>
            <FormGroup>
              {filterOptions.locations.map((location) => (
                <FilterCheckboxRow
                  key={location.id}
                  label={location.name}
                  count={locationCounts.get(location.id) || 0}
                  checked={selectedLocationIds.includes(location.id)}
                  onChange={() => onToggleLocation(location.id)}
                />
              ))}
            </FormGroup>
          </Box>

          <Divider />

          <Box>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5, letterSpacing: 0.8 }}
            >
              Room type
            </Typography>
            <FormGroup>
              {filterOptions.types.map((type) => (
                <FilterCheckboxRow
                  key={type}
                  label={formatRoomTypeLabel(type)}
                  count={typeCounts.get(type) || 0}
                  checked={selectedRoomTypes.includes(type)}
                  accentColor={roomTypeColor(type)}
                  onChange={() => onToggleRoomType(type)}
                />
              ))}
            </FormGroup>
          </Box>
        </Stack>
      </Box>

      <Box
        sx={(theme) => ({
          px: 1.5,
          py: 1.25,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.background.default, 0.45),
        })}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {overviewStats.roomCount} of {totalRoomCount} rooms shown
          </Typography>
          {hasActiveFilters ? (
            <Typography
              variant="caption"
              color="primary"
              sx={{ cursor: "pointer", fontWeight: 700 }}
              onClick={onClearFilters}
            >
              Clear
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Paper>
  );
}

export default function RoomViewerPanel({ rooms, roomAssignments }) {
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState([]);

  const toggleLocation = (locationId) => {
    setSelectedLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId],
    );
  };

  const toggleRoomType = (roomType) => {
    setSelectedRoomTypes((current) =>
      current.includes(roomType)
        ? current.filter((type) => type !== roomType)
        : [...current, roomType],
    );
  };

  const locations = useMemo(
    () => buildRoomOverview(rooms, roomAssignments),
    [rooms, roomAssignments],
  );

  const filterOptions = useMemo(() => {
    const locationOptions = locations.map((location) => ({
      id: location.locationId,
      name: location.locationName,
    }));
    const typeSet = new Set();

    locations.forEach((location) => {
      location.rooms.forEach((card) => {
        const type = String(card.room?.type || "").trim().toLowerCase();
        if (type) typeSet.add(type);
      });
    });

    return {
      locations: locationOptions,
      types: Array.from(typeSet).sort(),
    };
  }, [locations]);

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return locations
      .filter(
        (location) =>
          selectedLocationIds.length === 0 ||
          selectedLocationIds.includes(location.locationId),
      )
      .map((location) => ({
        ...location,
        rooms: location.rooms.filter((card) => {
          const roomType = String(card.room?.type || "").trim().toLowerCase();
          const typeMatch =
            selectedRoomTypes.length === 0 || selectedRoomTypes.includes(roomType);
          if (!typeMatch) return false;
          return roomMatchesSearch(card, location.locationName, query);
        }),
      }))
      .filter((location) => location.rooms.length > 0);
  }, [locations, searchQuery, selectedLocationIds, selectedRoomTypes]);

  const overviewStats = useMemo(() => {
    const allCards = filteredLocations.flatMap((location) => location.rooms);
    const roomsWithPlants = allCards.filter((card) => card.totalPlants > 0).length;

    return {
      locationCount: filteredLocations.length,
      roomCount: allCards.length,
      roomsWithPlants,
      totalPlants: allCards.reduce((sum, card) => sum + card.totalPlants, 0),
    };
  }, [filteredLocations]);

  const totalRoomCount = useMemo(
    () => locations.flatMap((location) => location.rooms).length,
    [locations],
  );

  const locationCounts = useMemo(() => {
    const counts = new Map();
    locations.forEach((location) => {
      counts.set(location.locationId, location.rooms.length);
    });
    return counts;
  }, [locations]);

  const typeCounts = useMemo(() => {
    const counts = new Map();
    locations.forEach((location) => {
      location.rooms.forEach((card) => {
        const type = String(card.room?.type || "").trim().toLowerCase();
        if (!type) return;
        counts.set(type, (counts.get(type) || 0) + 1);
      });
    });
    return counts;
  }, [locations]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedLocationIds.length > 0 || selectedRoomTypes.length > 0,
  );

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedLocationIds([]);
    setSelectedRoomTypes([]);
  };

  useEffect(() => {
    if (!selectedRoomId) return;
    const exists = (rooms || []).some(
      (room) => String(room._id) === String(selectedRoomId),
    );
    if (!exists) setSelectedRoomId(null);
  }, [rooms, selectedRoomId]);

  if (selectedRoomId) {
    const selectedRoom = (rooms || []).find(
      (room) => String(room._id) === String(selectedRoomId),
    );

    return (
      <Stack spacing={2} sx={{ height: "100%", minHeight: 480 }}>
        <Paper
          variant="outlined"
          sx={(theme) => ({
            p: 1.5,
            borderRadius: 2,
            background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.98)})`,
          })}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <IconButton
              size="small"
              onClick={() => setSelectedRoomId(null)}
              aria-label="Back to room overview"
              sx={{ border: "1px solid", borderColor: "divider" }}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {selectedRoom?.name || "Room detail"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedRoom?.locationId?.nickname || "—"} ·{" "}
                {selectedRoom?.type || "Room"}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <RoomViewer
          rooms={rooms}
          roomAssignments={roomAssignments}
          initialRoomId={selectedRoomId}
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ width: "100%", minWidth: 0, minHeight: 480 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Room Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Browse every room by location. Click a room for batch and strain details.
        </Typography>
      </Stack>

      <Grid container spacing={2} sx={{ minHeight: { md: 520 }, flex: 1, minWidth: 0 }}>
        <Grid
          size={{ xs: 12, md: 3.5, lg: 3 }}
          sx={{ height: { xs: "auto", md: "100%" }, minHeight: { md: 520 } }}
        >
          <RoomOverviewFilters
            overviewStats={overviewStats}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedLocationIds={selectedLocationIds}
            onToggleLocation={toggleLocation}
            selectedRoomTypes={selectedRoomTypes}
            onToggleRoomType={toggleRoomType}
            filterOptions={filterOptions}
            locationCounts={locationCounts}
            typeCounts={typeCounts}
            totalRoomCount={totalRoomCount}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 8.5, lg: 9 }} sx={{ minWidth: 0 }}>
          {locations.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No rooms found yet.
            </Alert>
          ) : filteredLocations.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No rooms match your search or filters.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {filteredLocations.map((location) => (
                <Paper key={location.locationId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <PlaceIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {location.locationName}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<MeetingRoomIcon />}
                      label={`${location.rooms.length} rooms`}
                    />
                  </Stack>

                  <Grid container spacing={1.5}>
                    {location.rooms.map((card) => (
                      <Grid key={card.room._id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                        <RoomOverviewCard card={card} onSelect={setSelectedRoomId} />
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              ))}
            </Stack>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
}
