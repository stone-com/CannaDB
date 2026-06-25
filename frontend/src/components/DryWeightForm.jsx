/**
 * DryWeightForm — enter final dry weights for harvests in the drying stage.
 * UI mirrors HarvestForm: default batch, accordion picker, dry room radios, confirm dialog.
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
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DryCleaningIcon from "@mui/icons-material/DryCleaning";
import ScaleIcon from "@mui/icons-material/Scale";
import SpaIcon from "@mui/icons-material/Spa";
import { apiPatch } from "../utils/api";
import { formatDate } from "../utils/formatDate";
import {
  buildHarvestListLabel,
  buildHarvestSearchText,
} from "../utils/harvestReportHelpers";
import {
  getDefaultByClosestDate,
  isDateToday,
} from "../utils/harvestWorkflowHelpers";
import FormSection from "./ui/FormSection";
import FormSubmitBar from "./ui/FormSubmitBar";
import MasterDetailShell from "./ui/MasterDetailShell";
import StatCard from "./ui/StatCard";

function DryWeightForm({ harvests, onComplete }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [batchPickerExpanded, setBatchPickerExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedDryRoomId, setSelectedDryRoomId] = useState("");
  const [selectedStrainKey, setSelectedStrainKey] = useState(null);
  const [dryWeightInput, setDryWeightInput] = useState("");
  const [dryWeightsByKey, setDryWeightsByKey] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sortedHarvests = useMemo(
    () =>
      Array.isArray(harvests)
        ? [...harvests].sort(
            (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
          )
        : [],
    [harvests],
  );

  const batchesForSelection = useMemo(
    () =>
      sortedHarvests
        .filter(
          (harvest) =>
            String(harvest?.batchId?.lifecycleStage || "").toLowerCase() ===
            "drying",
        )
        .map((harvest) => ({
          batchId: harvest?.batchId?._id || "",
          batchNumber: harvest?.batchId?.batchNumber || "Unknown Batch",
          harvest,
        })),
    [sortedHarvests],
  );

  const visibleBatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return batchesForSelection;

    return batchesForSelection.filter(({ harvest }) => {
      const searchText = buildHarvestSearchText(harvest, formatDate).toLowerCase();
      const batchNumber = String(harvest?.batchId?.batchNumber || "").toLowerCase();
      return searchText.includes(query) || batchNumber.includes(query);
    });
  }, [batchesForSelection, searchQuery]);

  useEffect(() => {
    if (batchesForSelection.length === 0 || selectedBatchId) return;

    const defaultEntry = getDefaultByClosestDate(
      batchesForSelection,
      (entry) => entry.harvest?.harvestDate || entry.harvest?.batchId?.harvestDate,
    );

    if (!defaultEntry?.batchId) return;

    setSelectedBatchId(defaultEntry.batchId);
    setSelectedDryRoomId("");
    setSelectedStrainKey(null);
    setDryWeightInput("");
    setDryWeightsByKey({});
  }, [batchesForSelection, selectedBatchId]);

  const selectedEntry = useMemo(
    () =>
      batchesForSelection.find(
        (entry) => String(entry.batchId) === String(selectedBatchId),
      ) || null,
    [batchesForSelection, selectedBatchId],
  );

  const selectedHarvest = selectedEntry?.harvest || null;

  const dryRoomsInHarvest = useMemo(() => {
    if (!selectedHarvest?.rooms) return [];

    const roomMap = new Map();
    selectedHarvest.rooms.forEach((roomEntry) => {
      const room = roomEntry?.roomId;
      if (room?._id) {
        roomMap.set(String(room._id), room);
      }
    });

    return Array.from(roomMap.values());
  }, [selectedHarvest]);

  useEffect(() => {
    if (!selectedHarvest || dryRoomsInHarvest.length === 0) return;

    const roomStillValid = dryRoomsInHarvest.some(
      (room) => String(room._id) === String(selectedDryRoomId),
    );

    if (selectedDryRoomId && roomStillValid) return;

    setSelectedDryRoomId(dryRoomsInHarvest[0]._id);
    setSelectedStrainKey(null);
    setDryWeightInput("");
  }, [dryRoomsInHarvest, selectedDryRoomId, selectedHarvest]);

  const harvestStrains = useMemo(() => {
    if (!selectedHarvest?.rooms) return [];

    const rows = [];

    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      const room = roomEntry?.roomId;
      const roomId = room?._id || "";
      const roomName = room?.name || "Unknown";
      const strains = Array.isArray(roomEntry?.strains) ? roomEntry.strains : [];

      strains.forEach((strainEntry, strainIndex) => {
        rows.push({
          key: `${roomIndex}-${strainIndex}`,
          roomId,
          roomName,
          strainName: strainEntry?.strainId?.name || "Unknown",
          plantCount: strainEntry?.plantCount || 0,
          existingDryWeight: strainEntry?.totalDryWeightGrams ?? null,
        });
      });
    });

    return rows;
  }, [selectedHarvest]);

  const visibleStrains = useMemo(
    () =>
      harvestStrains.filter(
        (entry) => String(entry.roomId) === String(selectedDryRoomId),
      ),
    [harvestStrains, selectedDryRoomId],
  );

  const selectedStrain = useMemo(
    () => visibleStrains.find((entry) => entry.key === selectedStrainKey) || null,
    [visibleStrains, selectedStrainKey],
  );

  const strainsWithWeights = useMemo(
    () =>
      harvestStrains.filter((entry) => dryWeightsByKey[entry.key] !== undefined)
        .length,
    [dryWeightsByKey, harvestStrains],
  );

  const activeDryWeight = useMemo(
    () => (selectedStrain ? dryWeightsByKey[selectedStrain.key] : undefined),
    [dryWeightsByKey, selectedStrain],
  );

  const submitSummary = useMemo(() => {
    let totalDryGrams = 0;

    harvestStrains.forEach((entry) => {
      const value =
        dryWeightsByKey[entry.key] ?? entry.existingDryWeight ?? 0;
      totalDryGrams += Number(value) || 0;
    });

    const dryRoom = dryRoomsInHarvest.find(
      (room) => String(room._id) === String(selectedDryRoomId),
    );

    return {
      dryRoomName: dryRoom?.name || "—",
      strainCount: harvestStrains.length,
      strainsWithWeights,
      totalDryGrams,
    };
  }, [
    dryRoomsInHarvest,
    dryWeightsByKey,
    harvestStrains,
    selectedDryRoomId,
    strainsWithWeights,
  ]);

  const handleBatchSelect = (batchId) => {
    setErrorMessage("");
    setSelectedBatchId(batchId);
    setSelectedDryRoomId("");
    setSelectedStrainKey(null);
    setDryWeightInput("");
    setDryWeightsByKey({});
    setBatchPickerExpanded(false);
  };

  const handleDryRoomSelect = (roomId) => {
    setErrorMessage("");
    setSelectedDryRoomId(roomId);
    setSelectedStrainKey(null);
    setDryWeightInput("");
  };

  const handleStrainSelect = (strainKey) => {
    setSelectedStrainKey(strainKey);
    const saved = dryWeightsByKey[strainKey];
    setDryWeightInput(saved !== undefined ? String(saved) : "");
  };

  const handleSetDryWeight = () => {
    if (!selectedStrainKey) return;

    const parsed = Number(dryWeightInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setErrorMessage("Enter a valid dry weight in grams.");
      return;
    }

    setErrorMessage("");
    setDryWeightsByKey((prev) => ({
      ...prev,
      [selectedStrainKey]: parsed,
    }));
  };

  const handleSubmitClick = () => {
    if (!selectedHarvest) {
      setErrorMessage("Select a drying batch before saving.");
      return;
    }

    setErrorMessage("");
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage("");

    try {
      const updatedRooms = (selectedHarvest.rooms || []).map(
        (roomEntry, roomIndex) => ({
          roomId: roomEntry?.roomId?._id,
          strains: (roomEntry?.strains || []).map((strainEntry, strainIndex) => {
            const key = `${roomIndex}-${strainIndex}`;
            const dryWeightValue =
              dryWeightsByKey[key] ?? strainEntry?.totalDryWeightGrams ?? 0;

            return {
              strainId: strainEntry?.strainId?._id,
              plantCount: strainEntry?.plantCount || 0,
              totes: (strainEntry?.totes || []).map((tote) => ({
                wetWeight: tote?.wetWeight || 0,
              })),
              totalDryWeightGrams: Number(dryWeightValue) || 0,
            };
          }),
        }),
      );

      await apiPatch(`/api/harvests/${selectedHarvest._id}`, {
        rooms: updatedRooms,
        finalizeDryWeights: true,
      });

      setConfirmOpen(false);

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      setErrorMessage(error.message || "Could not save dry weights.");
    } finally {
      setSubmitting(false);
    }
  };

  if (batchesForSelection.length === 0) {
    return (
      <Alert severity="info">
        No harvests in the drying stage are waiting for dry weight entry.
      </Alert>
    );
  }

  const sidebarHeader = selectedEntry ? (
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
        Drying batch
      </Typography>
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 0.75 }}>
        <CalendarTodayIcon fontSize="small" color="primary" sx={{ mt: 0.2 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
            {selectedEntry.batchNumber}
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={buildHarvestListLabel(selectedHarvest, formatDate)}
            />
            <Chip size="small" color="secondary" label="Drying" />
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
            placeholder="Search drying batches…"
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
              visibleBatches.map(({ batchId, batchNumber, harvest }) => {
                const isSelected = String(selectedBatchId) === String(batchId);
                const harvestToday = isDateToday(harvest?.harvestDate);

                return (
                  <ListItemButton
                    key={harvest._id}
                    selected={isSelected}
                    onClick={() => handleBatchSelect(batchId)}
                    sx={{ alignItems: "flex-start", py: 1, borderRadius: 1.5, mb: 0.25 }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {batchNumber}
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
                            label={`Harvest ${formatDate(harvest?.harvestDate)}`}
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

      {selectedHarvest ? (
        <Box sx={{ px: 1.5, py: 1.25 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
            <DryCleaningIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              Dry room
            </Typography>
          </Stack>
          {dryRoomsInHarvest.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              No dry rooms are linked to this harvest.
            </Typography>
          ) : (
            <RadioGroup
              value={selectedDryRoomId}
              onChange={(event) => handleDryRoomSelect(event.target.value)}
            >
              <Stack spacing={0.75}>
                {dryRoomsInHarvest.map((room) => {
                  const isSelected = String(selectedDryRoomId) === String(room._id);

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
                              Drying room
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

      {selectedHarvest && selectedDryRoomId ? (
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
              {visibleStrains.map((entry) => {
                const isActive = selectedStrainKey === entry.key;
                const hasInputDryWeight = dryWeightsByKey[entry.key] !== undefined;
                const dryWeightLabel = hasInputDryWeight
                  ? `${dryWeightsByKey[entry.key].toLocaleString()} g`
                  : entry.existingDryWeight != null
                    ? `${Number(entry.existingDryWeight).toLocaleString()} g saved`
                    : "Not set";

                return (
                  <ListItemButton
                    key={entry.key}
                    selected={isActive}
                    onClick={() => handleStrainSelect(entry.key)}
                    sx={{ borderRadius: 1.5, mb: 0.25 }}
                  >
                    <ListItemText
                      primary={entry.strainName}
                      secondary={`${entry.plantCount} plants`}
                      primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                    <Chip
                      size="small"
                      color={hasInputDryWeight ? "secondary" : "default"}
                      variant={hasInputDryWeight ? "filled" : "outlined"}
                      label={dryWeightLabel}
                    />
                  </ListItemButton>
                );
              })}
            </List>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1, px: 0.5 }}
            >
              {strainsWithWeights} of {harvestStrains.length} strains updated this session
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
          <DryCleaningIcon color="primary" fontSize="small" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {selectedStrain ? selectedStrain.strainName : "Dry weight entry"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {selectedHarvest
                ? `${selectedEntry?.batchNumber || "Batch"} · ${submitSummary.dryRoomName}`
                : "Select a drying batch to begin"}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {!selectedHarvest ? (
          <Alert severity="info">Choose a batch in the drying stage to begin.</Alert>
        ) : !selectedDryRoomId ? (
          <Alert severity="info">Select the dry room for this batch.</Alert>
        ) : !selectedStrain ? (
          <Alert severity="info">
            Select a strain to enter its total dry weight for this room.
          </Alert>
        ) : (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Box sx={{ flex: 1 }}>
                <StatCard
                  compact
                  label="Plants"
                  value={selectedStrain.plantCount.toLocaleString()}
                  icon={<SpaIcon />}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <StatCard compact label="Dry room" value={selectedStrain.roomName} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <StatCard
                  compact
                  label="Current dry weight"
                  value={
                    activeDryWeight === undefined
                      ? "Not set"
                      : `${activeDryWeight.toLocaleString()} g`
                  }
                  icon={<ScaleIcon />}
                />
              </Box>
            </Stack>

            <FormSection
              title="Set dry weight"
              subtitle="Enter the total dry weight in grams for this strain after drying."
            >
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  type="number"
                  fullWidth
                  size="small"
                  label="Total dry weight (grams)"
                  value={dryWeightInput}
                  onChange={(event) => setDryWeightInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSetDryWeight();
                    }
                  }}
                  placeholder="e.g. 1420"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ScaleIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button variant="contained" onClick={handleSetDryWeight} sx={{ minWidth: 96 }}>
                  Apply
                </Button>
              </Stack>
            </FormSection>

            <Alert severity="info" sx={{ py: 0.75 }}>
              Saving will finalize dry weights for all strains in this harvest. Strains
              you have not edited will keep their existing saved values.
            </Alert>
          </Stack>
        )}
      </Box>

      {selectedBatchId ? (
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
            {submitting ? "Saving…" : "Save & finalize dry weights"}
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
        <DialogTitle>Confirm dry weight finalization</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <Typography variant="body2">
              You are about to finalize dry weights for batch{" "}
              <strong>{selectedEntry?.batchNumber || "N/A"}</strong> (
              {formatDate(selectedHarvest?.harvestDate)}).
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {submitSummary.strainsWithWeights} of {submitSummary.strainCount} strains
              updated this session ·{" "}
              <strong>{submitSummary.totalDryGrams.toLocaleString()} g</strong> total dry
              weight across all dry rooms
            </Typography>
            <Typography variant="body2">
              This will mark the batch as completed and clear all dry room assignments
              for this batch. Are you sure?
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Confirm finalize"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Dry weight entry
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Record final dry weights and release drying rooms when complete.
        </Typography>
      </Box>

      <MasterDetailShell
        height={560}
        mobileSidebarHeight={320}
        sidebarHeader={sidebarHeader}
        sidebar={sidebar}
        detail={detail}
      />
    </Stack>
  );
}

export default DryWeightForm;
