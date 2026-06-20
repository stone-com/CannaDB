import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { apiPatch } from "../utils/api";

const SELECT_MENU_PROPS = {
  disablePortal: true,
};

// This form lets users enter final dry weights for strains after harvest.
// Users pick a drying batch, set weights per strain, then save them to the server.
function DryWeightForm({ harvests, onComplete }) {
  // Current selected batch/strain row.
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedStrainKey, setSelectedStrainKey] = useState(null);
  // Input value and saved dry weights.
  const [dryWeightInput, setDryWeightInput] = useState("");
  const [dryWeightsByKey, setDryWeightsByKey] = useState({});

  const sortedHarvests = useMemo(
    // Sorting newest first makes most recent dry-weight tasks easier to reach.
    () =>
      Array.isArray(harvests)
        ? [...harvests].sort(
            (a, b) => new Date(b.harvestDate) - new Date(a.harvestDate),
          )
        : [],
    [harvests],
  );

  // Only include harvests whose batch is in the drying stage.
  const batchesForSelection = useMemo(
    // Build select-friendly rows so dropdown has batch id + display context.
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

  const selectedHarvest = useMemo(
    // Resolve selected dropdown value into the full harvest object.
    () =>
      batchesForSelection.find(
        (entry) => String(entry.batchId) === String(selectedBatchId),
      )?.harvest || null,
    [batchesForSelection, selectedBatchId],
  );

  const harvestStrains = useMemo(() => {
    // Flatten room->strain nested data into simple rows for button list rendering.
    if (!selectedHarvest || !Array.isArray(selectedHarvest.rooms)) {
      return [];
    }

    const rows = [];

    selectedHarvest.rooms.forEach((roomEntry, roomIndex) => {
      const roomName = roomEntry?.roomId?.name || "Unknown";
      const strains = Array.isArray(roomEntry?.strains)
        ? roomEntry.strains
        : [];

      strains.forEach((strainEntry, strainIndex) => {
        rows.push({
          key: `${roomIndex}-${strainIndex}`,
          roomName,
          strainName: strainEntry?.strainId?.name || "Unknown",
          plantCount: strainEntry?.plantCount || 0,
        });
      });
    });

    return rows;
  }, [selectedHarvest]);

  const selectedStrain = useMemo(
    // Resolve selected key into the full row object used by the right editor.
    () =>
      harvestStrains.find((entry) => entry.key === selectedStrainKey) || null,
    [harvestStrains, selectedStrainKey],
  );

  // Clears strain and weight fields when the user picks a different batch.
  const handleBatchChange = (e) => {
    setSelectedBatchId(e.target.value);
    setSelectedStrainKey(null);
    setDryWeightInput("");
    setDryWeightsByKey({});
  };

  // Selects a strain row so the user can enter its dry weight on the right.
  const handleStrainClick = (strainKey) => {
    setSelectedStrainKey(strainKey);
    setDryWeightInput("");
  };

  // Saves the typed dry weight value for the currently selected strain.
  const handleSetDryWeight = () => {
    if (!selectedStrainKey) return;

    const parsed = Number(dryWeightInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      window.alert("Enter a valid dry weight in grams.");
      return;
    }

    setDryWeightsByKey((prev) => ({
      ...prev,
      [selectedStrainKey]: parsed,
    }));
  };

  // Sends all dry weights to the server and finalizes the harvest record.
  const handleSubmit = async () => {
    if (!selectedHarvest) {
      window.alert("Please select a harvest.");
      return;
    }

    try {
      const updatedRooms = (selectedHarvest.rooms || []).map(
        (roomEntry, roomIndex) => ({
          roomId: roomEntry?.roomId?._id,
          strains: (roomEntry?.strains || []).map(
            (strainEntry, strainIndex) => {
              const key = `${roomIndex}-${strainIndex}`;
              const dryWeightValue =
                dryWeightsByKey[key] ?? strainEntry?.totalDryWeightGrams ?? 0;

              return {
                // Keep original tote wet weights and write the new dry total.
                strainId: strainEntry?.strainId?._id,
                plantCount: strainEntry?.plantCount || 0,
                totes: (strainEntry?.totes || []).map((tote) => ({
                  wetWeight: tote?.wetWeight || 0,
                })),
                totalDryWeightGrams: Number(dryWeightValue) || 0,
              };
            },
          ),
        }),
      );

      await apiPatch(`/api/harvests/${selectedHarvest._id}`, {
        rooms: updatedRooms,
        finalizeDryWeights: true,
      });

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      window.alert(`Error: ${error.message}`);
    }
  };

  const activeDryWeight = useMemo(
    // Read current value for the selected row from keyed state map.
    () => (selectedStrain ? dryWeightsByKey[selectedStrain.key] : undefined),
    [dryWeightsByKey, selectedStrain],
  );

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      sx={{ height: "100%" }}
    >
      {/* Left side: batch picker, strain list, and save button */}
      <Stack spacing={2} sx={{ width: { xs: "100%", md: 420 } }}>
        {/* Page title */}
        <Typography variant="h6">Dry Weight Entry</Typography>

        {/* Batch dropdown (only batches in drying stage) */}
        <TextField
          select
          label="Batch (Drying Only)"
          value={selectedBatchId}
          onChange={handleBatchChange}
          // disablePortal prevents menu clipping in portal-heavy window layouts.
          SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
        >
          <MenuItem value="">Select Batch</MenuItem>
          {batchesForSelection.map(({ batchId, batchNumber, harvest }) => {
            // Build a verbose dropdown label so users can identify the exact harvest.
            const date = new Date(harvest?.harvestDate);
            const dateText = Number.isNaN(date.getTime())
              ? "N/A"
              : date.toLocaleDateString();
            const harvestNumberText = harvest?.harvestNumber || "No Number";
            const locationText = harvest?.locationId?.nickname || "No Location";
            const roomNames = (harvest?.rooms || [])
              .map((roomEntry) => roomEntry?.roomId?.name)
              .filter(Boolean)
              .join(", ");
            const label = `${batchNumber} - ${dateText} - ${harvestNumberText} - ${locationText} - ${roomNames || "No Rooms"}`;

            return (
              <MenuItem key={harvest._id} value={batchId}>
                {label}
              </MenuItem>
            );
          })}
        </TextField>

        {/* Strain buttons showing dry weight status per row */}
        {selectedHarvest && (
          <Card variant="outlined">
            <CardContent>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {selectedHarvest.harvestNumber || "Harvest"} Strains
              </Typography>
              <Stack spacing={1}>
                {harvestStrains.map((entry) => {
                  // Each row button opens that strain in the right-side editor.
                  const isActive = selectedStrainKey === entry.key;
                  const hasInputDryWeight =
                    dryWeightsByKey[entry.key] !== undefined;
                  const dryWeight = hasInputDryWeight
                    ? `${dryWeightsByKey[entry.key]} g`
                    : "Not set";

                  return (
                    <Button
                      key={entry.key}
                      variant={isActive ? "contained" : "outlined"}
                      color={isActive ? "primary" : "inherit"}
                      onClick={() => handleStrainClick(entry.key)}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <span>
                        {entry.strainName} ({entry.roomName}) -{" "}
                        {entry.plantCount} Plants
                      </span>
                      <Chip size="small" color="secondary" label={dryWeight} />
                    </Button>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        )}

        {selectedBatchId && (
          // Save button appears once a harvest context exists.
          <Button variant="contained" size="large" onClick={handleSubmit}>
            Save Dry Weights
          </Button>
        )}
      </Stack>

      {/* Right side: dry weight editor for the selected strain */}
      <Box sx={{ flex: 1 }}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardContent>
            {selectedStrain ? (
              // Right-side editor updates whichever row is currently selected.
              <Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {selectedStrain.strainName} ({selectedStrain.roomName})
                </Typography>

                <Stack direction="row" spacing={1}>
                  <TextField
                    type="number"
                    fullWidth
                    label="Total Dry Weight (grams)"
                    value={dryWeightInput}
                    onChange={(e) => setDryWeightInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSetDryWeight();
                      }
                    }}
                    placeholder="e.g. 1420"
                  />
                  <Button variant="contained" onClick={handleSetDryWeight}>
                    Set
                  </Button>
                </Stack>

                <Typography variant="body1">
                  Current Dry Weight:{" "}
                  <strong>
                    {activeDryWeight === undefined
                      ? "Not set"
                      : `${activeDryWeight} g`}
                  </strong>
                </Typography>
              </Stack>
            ) : (
              <Alert severity="info">
                {selectedHarvest
                  ? "Click a strain on the left to enter dry weight."
                  : "Select a batch to get started."}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

export default DryWeightForm;
