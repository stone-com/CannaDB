/**
 * HarvestForm — record wet harvest tote weights for a batch room.
 * Uses scrollable pickers (no Select menus) so dropdowns work inside workspace panels.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AgricultureIcon from "@mui/icons-material/Agriculture";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import SpaIcon from "@mui/icons-material/Spa";
import ScaleIcon from "@mui/icons-material/Scale";
import { apiGet, apiPost } from "../utils/api";
import { formatDate } from "../utils/formatDate";
import {
  getDefaultByClosestDate,
  groupHarvestRoomsByDryRoom,
  isDateToday,
} from "../utils/harvestWorkflowHelpers";
import {
  clearHarvestFormDraft,
  persistHarvestFormDraft,
  readHarvestFormDraft,
} from "../utils/harvestFormDraft";
import FormSection from "./ui/FormSection";
import FormSubmitBar from "./ui/FormSubmitBar";
import ListRow from "./ui/ListRow";
import MasterDetailShell from "./ui/MasterDetailShell";
import RemoveButton from "./ui/RemoveButton";
import StatCard from "./ui/StatCard";

function HarvestForm({ onComplete }) {
  const savedDraft = useMemo(() => readHarvestFormDraft(), []);

  const [batches, setBatches] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [roomAssignments, setRoomAssignments] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState(savedDraft?.searchQuery ?? "");
  const [batchPickerExpanded, setBatchPickerExpanded] = useState(
    savedDraft?.batchPickerExpanded ?? false,
  );
  const [selectedBatchId, setSelectedBatchId] = useState(
    savedDraft?.selectedBatchId ?? "",
  );
  const [selectedRoomId, setSelectedRoomId] = useState(savedDraft?.selectedRoomId ?? "");
  const [selectedStrainId, setSelectedStrainId] = useState(
    savedDraft?.selectedStrainId ?? null,
  );
  const [dryRoomByStrainId, setDryRoomByStrainId] = useState(
    savedDraft?.dryRoomByStrainId ?? {},
  );
  const [totes, setTotes] = useState(savedDraft?.totes ?? {});
  const [weightInput, setWeightInput] = useState(savedDraft?.weightInput ?? "");

  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        const [batchData, assignmentData, roomData] = await Promise.all([
          apiGet("/api/batches"),
          apiGet("/api/room-assignments?active=true"),
          apiGet("/api/rooms"),
        ]);
        setBatches(Array.isArray(batchData) ? batchData : []);
        setRoomAssignments(Array.isArray(assignmentData) ? assignmentData : []);
        setAllRooms(Array.isArray(roomData) ? roomData : []);
      } catch (error) {
        console.error("Error fetching harvest form data:", error);
        setErrorMessage(error.message || "Could not load harvest data.");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    persistHarvestFormDraft({
      searchQuery,
      batchPickerExpanded,
      selectedBatchId,
      selectedRoomId,
      selectedStrainId,
      dryRoomByStrainId,
      totes,
      weightInput,
    });
  }, [
    batchPickerExpanded,
    dryRoomByStrainId,
    searchQuery,
    selectedBatchId,
    selectedRoomId,
    selectedStrainId,
    totes,
    weightInput,
  ]);

  const unharvestedBatches = useMemo(
    () =>
      batches.filter(
        (batch) =>
          !batch.harvestId &&
          String(batch.lifecycleStage || "").toLowerCase() === "harvestready",
      ),
    [batches],
  );

  const visibleBatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return unharvestedBatches;

    return unharvestedBatches.filter((batch) => {
      const batchNumber = String(batch.batchNumber || "").toLowerCase();
      const dateText = formatDate(batch.harvestDate).toLowerCase();
      return batchNumber.includes(query) || dateText.includes(query);
    });
  }, [searchQuery, unharvestedBatches]);

  useEffect(() => {
    if (loadingData || unharvestedBatches.length === 0 || selectedBatchId) return;

    const defaultBatch = getDefaultByClosestDate(
      unharvestedBatches,
      (batch) => batch.harvestDate,
    );
    if (!defaultBatch?._id) return;

    setSelectedBatchId(defaultBatch._id);
    setSelectedRoomId("");
    setSelectedStrainId(null);
    setDryRoomByStrainId({});
    setTotes({});
    setWeightInput("");
  }, [loadingData, selectedBatchId, unharvestedBatches]);

  useEffect(() => {
    if (loadingData || !selectedBatchId) return;

    const batchStillAvailable = unharvestedBatches.some(
      (batch) => String(batch._id) === String(selectedBatchId),
    );

    if (batchStillAvailable) return;

    clearHarvestFormDraft();
    setSelectedBatchId("");
    setSelectedRoomId("");
    setSelectedStrainId(null);
    setDryRoomByStrainId({});
    setTotes({});
    setWeightInput("");
  }, [loadingData, selectedBatchId, unharvestedBatches]);

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch._id === selectedBatchId) || null,
    [batches, selectedBatchId],
  );

  const flowerRooms = useMemo(() => {
    if (!selectedBatchId) return [];

    const assignedRoomMap = new Map();

    roomAssignments
      .filter(
        (assignment) =>
          String(assignment?.batchId?._id) === String(selectedBatchId) &&
          assignment?.active !== false,
      )
      .forEach((assignment) => {
        const room = assignment?.roomId;
        if (room?._id) {
          assignedRoomMap.set(String(room._id), room);
        }
      });

    return Array.from(assignedRoomMap.values());
  }, [roomAssignments, selectedBatchId]);

  const batchLocationId = useMemo(() => {
    if (selectedBatch?.location) {
      return String(selectedBatch.location._id || selectedBatch.location);
    }

    const flowerRoom = flowerRooms.find((room) => room._id === selectedRoomId);
    if (flowerRoom?.locationId?._id) {
      return String(flowerRoom.locationId._id);
    }
    if (flowerRoom?.locationId) {
      return String(flowerRoom.locationId);
    }

    return "";
  }, [flowerRooms, selectedBatch, selectedRoomId]);

  const dryingRooms = useMemo(() => {
    if (!batchLocationId) return [];

    return allRooms.filter(
      (room) =>
        String(room.type) === "Drying" &&
        String(room.locationId?._id || room.locationId) === batchLocationId,
    );
  }, [allRooms, batchLocationId]);

  useEffect(() => {
    if (!selectedBatchId || flowerRooms.length === 0) return;

    const roomStillValid =
      selectedRoomId &&
      flowerRooms.some((room) => String(room._id) === String(selectedRoomId));

    if (roomStillValid) return;

    const nextRoomId = flowerRooms[0]._id;
    setSelectedRoomId(nextRoomId);

    if (selectedRoomId && String(selectedRoomId) !== String(nextRoomId)) {
      setSelectedStrainId(null);
      setDryRoomByStrainId({});
      setTotes({});
      setWeightInput("");
    }
  }, [flowerRooms, selectedBatchId, selectedRoomId]);

  const selectedRoomAssignment = useMemo(
    () =>
      roomAssignments.find(
        (assignment) =>
          String(assignment?.batchId?._id) === String(selectedBatchId) &&
          String(assignment?.roomId?._id) === String(selectedRoomId) &&
          assignment?.active !== false,
      ) || null,
    [roomAssignments, selectedBatchId, selectedRoomId],
  );

  const activePlants = useMemo(
    () =>
      Array.isArray(selectedRoomAssignment?.assignedPlants)
        ? selectedRoomAssignment.assignedPlants
        : [],
    [selectedRoomAssignment],
  );

  useEffect(() => {
    if (!selectedRoomId || dryingRooms.length === 0 || activePlants.length === 0) {
      return;
    }

    const defaultDryRoomId = dryingRooms[0]._id;

    setDryRoomByStrainId((prev) => {
      const next = { ...prev };
      let changed = false;

      activePlants.forEach((plant) => {
        const strainId = plant.strainId?._id;
        if (!strainId) return;

        const currentRoomId = next[strainId];
        const stillValid = dryingRooms.some(
          (room) => String(room._id) === String(currentRoomId),
        );

        if (!currentRoomId || !stillValid) {
          next[strainId] = defaultDryRoomId;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [activePlants, dryingRooms, selectedRoomId]);

  const selectedStrainPlant = useMemo(
    () =>
      activePlants.find((plant) => plant.strainId?._id === selectedStrainId) ||
      null,
    [activePlants, selectedStrainId],
  );

  const totalPlants = useMemo(
    () => activePlants.reduce((sum, plant) => sum + (plant.count || 0), 0),
    [activePlants],
  );

  const activeTotes = useMemo(
    () => (selectedStrainId ? totes[selectedStrainId] || [] : []),
    [selectedStrainId, totes],
  );

  const activeToteTotal = useMemo(
    () => activeTotes.reduce((sum, weight) => sum + weight, 0),
    [activeTotes],
  );

  const strainsWithTotes = useMemo(
    () =>
      activePlants.filter(
        (plant) => (totes[plant.strainId?._id] || []).length > 0,
      ).length,
    [activePlants, totes],
  );

  const submitSummary = useMemo(() => {
    const flowerRoom = flowerRooms.find((entry) => entry._id === selectedRoomId);
    let totalWetGrams = 0;
    const dryRoomCounts = new Map();

    activePlants.forEach((plant) => {
      const strainId = plant.strainId?._id;
      const strainTotes = totes[strainId] || [];
      totalWetGrams += strainTotes.reduce((sum, weight) => sum + weight, 0);

      const dryRoomId = dryRoomByStrainId[strainId];
      if (dryRoomId) {
        dryRoomCounts.set(dryRoomId, (dryRoomCounts.get(dryRoomId) || 0) + 1);
      }
    });

    const dryRoomSummary = Array.from(dryRoomCounts.entries()).map(
      ([roomId, count]) => {
        const room = dryingRooms.find((entry) => String(entry._id) === String(roomId));
        return { roomName: room?.name || "Dry room", strainCount: count };
      },
    );

    return {
      flowerRoomName: flowerRoom?.name || "—",
      strainCount: activePlants.length,
      strainsWithTotes,
      totalWetGrams,
      dryRoomSummary,
    };
  }, [
    activePlants,
    dryRoomByStrainId,
    dryingRooms,
    flowerRooms,
    selectedRoomId,
    strainsWithTotes,
    totes,
  ]);

  const resetSelection = () => {
    clearHarvestFormDraft();

    const defaultBatch = getDefaultByClosestDate(
      unharvestedBatches,
      (batch) => batch.harvestDate,
    );
    setSelectedBatchId(defaultBatch?._id || "");
    setSelectedRoomId("");
    setSelectedStrainId(null);
    setDryRoomByStrainId({});
    setTotes({});
    setWeightInput("");
    setSearchQuery("");
    setBatchPickerExpanded(false);
  };

  const handleBatchSelect = (batchId) => {
    setErrorMessage("");
    setSelectedBatchId(batchId);
    setSelectedRoomId("");
    setSelectedStrainId(null);
    setDryRoomByStrainId({});
    setTotes({});
    setWeightInput("");
    setBatchPickerExpanded(false);
  };

  const handleRoomSelect = (roomId) => {
    setErrorMessage("");
    setSelectedRoomId(roomId);
    setSelectedStrainId(null);
    setDryRoomByStrainId({});
    setTotes({});
    setWeightInput("");
  };

  const handleDryRoomSelect = (strainId, roomId) => {
    setDryRoomByStrainId((prev) => ({ ...prev, [strainId]: roomId }));
  };

  const handleStrainSelect = (strainId) => {
    setSelectedStrainId(strainId);
    setWeightInput("");
  };

  const handleAddTote = () => {
    const weight = parseFloat(weightInput);
    if (Number.isNaN(weight) || weight <= 0) return;

    setTotes((prev) => ({
      ...prev,
      [selectedStrainId]: [...(prev[selectedStrainId] || []), weight],
    }));
    setWeightInput("");
  };

  const handleRemoveTote = (strainId, index) => {
    setTotes((prev) => ({
      ...prev,
      [strainId]: prev[strainId].filter((_, i) => i !== index),
    }));
  };

  const handleSubmitClick = () => {
    if (!selectedBatchId || !selectedRoomId) {
      setErrorMessage("Select a batch and flower room before submitting.");
      return;
    }

    if (dryingRooms.length === 0) {
      setErrorMessage("No drying rooms are available at this batch location.");
      return;
    }

    const missingDryRoom = activePlants.some(
      (plant) => !dryRoomByStrainId[plant.strainId?._id],
    );

    if (missingDryRoom) {
      setErrorMessage("Assign every strain to a dry room before submitting.");
      return;
    }

    setErrorMessage("");
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage("");

    try {
      const roomsPayload = groupHarvestRoomsByDryRoom(
        activePlants,
        totes,
        dryRoomByStrainId,
      );

      if (roomsPayload.length === 0) {
        setErrorMessage("Assign every strain to a dry room before submitting.");
        return;
      }

      const flowerRoom = flowerRooms.find((entry) => entry._id === selectedRoomId);
      const firstDryRoom = dryingRooms.find(
        (room) => String(room._id) === String(roomsPayload[0]?.roomId),
      );
      const locationId =
        firstDryRoom?.locationId?._id ||
        firstDryRoom?.locationId ||
        flowerRoom?.locationId?._id ||
        flowerRoom?.locationId ||
        selectedBatch?.location;

      if (!locationId) {
        setErrorMessage("Could not find location for the selected rooms.");
        return;
      }

      const payload = {
        batchId: selectedBatchId,
        locationId,
        harvestNumber: `${selectedBatch?.batchNumber}-${Date.now()}`,
        harvestDate: selectedBatch?.harvestDate || new Date().toISOString(),
        rooms: roomsPayload,
      };

      await apiPost("/api/harvests", payload);
      setConfirmOpen(false);
      resetSelection();

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      setErrorMessage(error.message || "Could not submit harvest.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Loading harvest-ready batches…
        </Typography>
      </Stack>
    );
  }

  if (unharvestedBatches.length === 0) {
    return (
      <Alert severity="info">
        No harvest-ready batches are available for intake right now.
      </Alert>
    );
  }

  const sidebarHeader = selectedBatch ? (
    <Box
      sx={(theme) => ({
        p: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.primary.main, 0.05),
      })}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}
      >
        Harvest batch
      </Typography>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 0.75 }}>
        <CalendarTodayIcon fontSize="small" color="primary" sx={{ mt: 0.2 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
            {selectedBatch.batchNumber}
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`Harvest ${formatDate(selectedBatch.harvestDate)}`}
            />
            <Chip size="small" color="success" label="HarvestReady" />
          </Stack>
        </Box>
      </Stack>
    </Box>
  ) : null;

  const sidebar = (
    <Box>
      <Accordion
        expanded={batchPickerExpanded}
        onChange={(_, expanded) => setBatchPickerExpanded(expanded)}
        disableGutters
        elevation={0}
        sx={{
          "&::before": { display: "none" },
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: 44,
            px: 1.5,
            "& .MuiAccordionSummary-content": { my: 0.75 },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Change batch
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search batches…"
            sx={{ mb: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <List dense disablePadding>
            {visibleBatches.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, py: 1 }}>
                No batches match your search.
              </Typography>
            ) : (
              visibleBatches.map((batch) => {
                const isSelected = selectedBatchId === batch._id;
                const harvestToday = isDateToday(batch.harvestDate);

                return (
                  <ListItemButton
                    key={batch._id}
                    selected={isSelected}
                    onClick={() => handleBatchSelect(batch._id)}
                    sx={{ alignItems: "flex-start", py: 1, borderRadius: 1.5, mb: 0.25 }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {batch.batchNumber}
                        </Typography>
                      }
                      secondary={
                        <Stack
                          direction="row"
                          spacing={0.5}
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ mt: 0.35 }}
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<CalendarTodayIcon sx={{ "&&": { fontSize: 14 } }} />}
                            label={`Harvest ${formatDate(batch.harvestDate)}`}
                          />
                          {harvestToday ? (
                            <Chip size="small" color="primary" label="Today" />
                          ) : null}
                        </Stack>
                      }
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ component: "div" }}
                    />
                  </ListItemButton>
                );
              })
            )}
          </List>
        </AccordionDetails>
      </Accordion>

      {selectedBatch ? (
        <Box sx={{ px: 1.5, py: 1.25 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
            <MeetingRoomIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Flower room
            </Typography>
          </Stack>
          {flowerRooms.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              No active flower room assignments for this batch.
            </Typography>
          ) : (
            <RadioGroup
              value={selectedRoomId}
              onChange={(event) => handleRoomSelect(event.target.value)}
            >
              <Stack spacing={0.75}>
                {flowerRooms.map((room) => {
                  const isSelected = selectedRoomId === room._id;

                  return (
                    <Paper
                      key={room._id}
                      variant="outlined"
                      component="label"
                      sx={(theme) => ({
                        display: "block",
                        borderRadius: 1.5,
                        cursor: "pointer",
                        borderColor: isSelected
                          ? theme.palette.primary.main
                          : alpha(theme.palette.divider, 0.85),
                        bgcolor: isSelected
                          ? alpha(theme.palette.primary.main, 0.08)
                          : alpha(theme.palette.background.paper, 0.6),
                        transition: theme.transitions.create(
                          ["border-color", "background-color"],
                          { duration: theme.transitions.duration.shorter },
                        ),
                        "&:hover": {
                          borderColor: alpha(theme.palette.primary.main, 0.55),
                        },
                      })}
                    >
                      <FormControlLabel
                        value={room._id}
                        control={<Radio size="small" />}
                        label={
                          <Box sx={{ py: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {room.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {room.type || room.locationId?.nickname || "—"}
                            </Typography>
                          </Box>
                        }
                        sx={{
                          m: 0,
                          width: "100%",
                          alignItems: "flex-start",
                          px: 1,
                          py: 0.75,
                        }}
                      />
                    </Paper>
                  );
                })}
              </Stack>
            </RadioGroup>
          )}
        </Box>
      ) : null}

      {selectedBatch && selectedRoomId ? (
        <>
          <Divider />
          <Box sx={{ px: 1.5, py: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
              <SpaIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Strains in room
              </Typography>
            </Stack>
            <List dense disablePadding>
              {activePlants.map((plant) => {
                const strainId = plant.strainId?._id;
                const toteCount = (totes[strainId] || []).length;
                const dryRoomName =
                  dryingRooms.find(
                    (room) => String(room._id) === String(dryRoomByStrainId[strainId]),
                  )?.name || "Dry room";

                return (
                  <ListItemButton
                    key={strainId}
                    selected={selectedStrainId === strainId}
                    onClick={() => handleStrainSelect(strainId)}
                    sx={{ borderRadius: 1.5, mb: 0.25 }}
                  >
                    <ListItemText
                      primary={plant.strainId?.name || "Unknown"}
                      secondary={`${plant.count || 0} plants`}
                      primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="small" variant="outlined" label={dryRoomName} />
                      {toteCount > 0 ? (
                        <Chip
                          size="small"
                          color="secondary"
                          label={`${toteCount} tote${toteCount === 1 ? "" : "s"}`}
                        />
                      ) : null}
                    </Stack>
                  </ListItemButton>
                );
              })}
            </List>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1, px: 0.5 }}
            >
              {strainsWithTotes} of {activePlants.length} strains have tote weights
            </Typography>
          </Box>
        </>
      ) : null}
    </Box>
  );

  const detail = (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        minHeight: { xs: 320, md: 0 },
      }}
    >
      <Box
        sx={(theme) => ({
          px: 2,
          py: 1.25,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.primary.main, 0.06),
        })}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <AgricultureIcon color="primary" fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {selectedStrainPlant
                ? selectedStrainPlant.strainId?.name
                : "Wet weight entry"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {selectedBatch
                ? `${selectedBatch.batchNumber}${selectedRoomId ? ` · ${flowerRooms.find((room) => room._id === selectedRoomId)?.name || "Flower room"}` : ""}`
                : "Select a batch and flower room to begin"}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {!selectedBatch ? (
          <Alert severity="info">Choose a harvest-ready batch to begin intake.</Alert>
        ) : !selectedRoomId ? (
          <Alert severity="info">Select the flower room where this harvest took place.</Alert>
        ) : dryingRooms.length === 0 ? (
          <Alert severity="warning">
            No drying rooms are configured at this location. Add a Drying room before
            submitting harvest intake.
          </Alert>
        ) : !selectedStrainPlant ? (
          <Alert severity="info">
            Select a strain to record tote-level wet weights for this room.
          </Alert>
        ) : (
          <Stack spacing={2}>
            <GridSummary
              plantCount={selectedStrainPlant.count || 0}
              toteCount={activeTotes.length}
              totalGrams={activeToteTotal}
              roomTotalPlants={totalPlants}
            />

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700, display: "block", mb: 0.75 }}
              >
                Dry room
              </Typography>
              {dryingRooms.length === 0 ? (
                <Alert severity="warning" sx={{ py: 0.25 }}>
                  No drying rooms are available at this location.
                </Alert>
              ) : (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={dryRoomByStrainId[selectedStrainId] || ""}
                  onChange={(_, roomId) => {
                    if (roomId) handleDryRoomSelect(selectedStrainId, roomId);
                  }}
                  sx={{ flexWrap: "wrap", gap: 0.5 }}
                >
                  {dryingRooms.map((room) => (
                    <ToggleButton
                      key={room._id}
                      value={room._id}
                      sx={{ px: 1.25, py: 0.35, textTransform: "none" }}
                    >
                      {room.name}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
            </Box>

            <FormSection
              title="Add tote weight"
              subtitle="Enter wet weight in grams for each tote pulled from this strain."
            >
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  type="number"
                  label="Wet weight (grams)"
                  fullWidth
                  size="small"
                  value={weightInput}
                  onChange={(event) => setWeightInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddTote();
                    }
                  }}
                  placeholder="e.g. 2660"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ScaleIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button variant="contained" onClick={handleAddTote} sx={{ minWidth: 96 }}>
                  Add tote
                </Button>
              </Stack>
            </FormSection>

            <FormSection title="Recorded totes">
              {activeTotes.length > 0 ? (
                <Stack spacing={1}>
                  {activeTotes.map((weight, index) => (
                    <ListRow
                      key={`${selectedStrainId}-${index}`}
                      label={
                        <Typography variant="body2">
                          Tote {index + 1}:{" "}
                          <strong>{weight.toLocaleString()} g</strong>
                        </Typography>
                      }
                    >
                      <RemoveButton
                        label="Remove tote"
                        onClick={() => handleRemoveTote(selectedStrainId, index)}
                      />
                    </ListRow>
                  ))}
                  <Typography variant="body2" sx={{ pt: 0.5 }}>
                    Strain total:{" "}
                    <strong>{activeToteTotal.toLocaleString()} g wet</strong>
                  </Typography>
                </Stack>
              ) : (
                <Alert severity="info" sx={{ py: 0.5 }}>
                  No tote weights recorded for this strain yet.
                </Alert>
              )}
            </FormSection>
          </Stack>
        )}
      </Box>

      {selectedBatchId && selectedRoomId ? (
        <Box sx={{ px: 2, pb: 2 }}>
          {errorMessage ? (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {errorMessage}
            </Alert>
          ) : null}
          <FormSubmitBar
            type="button"
            disabled={submitting}
            fullWidth
            onClick={handleSubmitClick}
          >
            {submitting ? "Submitting…" : "Submit harvest intake"}
          </FormSubmitBar>
        </Box>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (submitting) return;
          setConfirmOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Confirm harvest intake</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Typography variant="body2">
              You are about to submit wet harvest weights for batch{" "}
              <strong>{selectedBatch?.batchNumber || "N/A"}</strong> (
              {formatDate(selectedBatch?.harvestDate)}) harvested from flower room{" "}
              <strong>{submitSummary.flowerRoomName}</strong>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {submitSummary.strainsWithTotes} of {submitSummary.strainCount} strains
              have tote weights recorded ·{" "}
              <strong>{submitSummary.totalWetGrams.toLocaleString()} g</strong> total
              wet weight · <strong>{totalPlants.toLocaleString()}</strong> plants
            </Typography>
            {submitSummary.dryRoomSummary.length > 0 ? (
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Dry room assignments
                </Typography>
                {submitSummary.dryRoomSummary.map((entry) => (
                  <Typography key={entry.roomName} variant="body2">
                    <strong>{entry.roomName}</strong> — {entry.strainCount} strain
                    {entry.strainCount === 1 ? "" : "s"}
                  </Typography>
                ))}
              </Stack>
            ) : null}
            {submitSummary.strainsWithTotes < submitSummary.strainCount ? (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Some strains have no tote weights. They will be submitted with empty
                wet weight entries.
              </Alert>
            ) : null}
            <Alert severity="info" sx={{ py: 0.5 }}>
              This will empty the flower room, assign strains to the selected dry
              rooms, and move the batch into the drying stage.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Confirm & submit harvest"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );

  return (
    <MasterDetailShell
      sx={{ flex: 1, minHeight: 0, height: "100%" }}
      mobileSidebarHeight={320}
      sidebarHeader={sidebarHeader}
      sidebar={sidebar}
      detail={detail}
    />
  );
}

function GridSummary({ plantCount, toteCount, totalGrams, roomTotalPlants }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Box sx={{ flex: 1 }}>
        <StatCard compact label="Plants (strain)" value={plantCount.toLocaleString()} icon={<SpaIcon />} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <StatCard compact label="Totes recorded" value={toteCount} icon={<ScaleIcon />} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <StatCard
          compact
          label="Wet total (strain)"
          value={`${totalGrams.toLocaleString()} g`}
          hint={`${roomTotalPlants.toLocaleString()} plants in room`}
        />
      </Box>
    </Stack>
  );
}

export default HarvestForm;
