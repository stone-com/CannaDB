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

const SELECT_MENU_PROPS = {
  disablePortal: true,
};

function DryWeightForm({ harvests, onComplete }) {
  // Current selected batch/strain row.
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedStrainKey, setSelectedStrainKey] = useState(null);
  // Input value and saved dry weights.
  const [dryWeightInput, setDryWeightInput] = useState("");
  const [dryWeightsByKey, setDryWeightsByKey] = useState({});

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
      sortedHarvests.map((harvest) => ({
        batchId: harvest?.batchId?._id || "",
        batchNumber: harvest?.batchId?.batchNumber || "Unknown Batch",
        harvest,
      })),
    [sortedHarvests],
  );

  const selectedHarvest = useMemo(
    () =>
      batchesForSelection.find(
        (entry) => String(entry.batchId) === String(selectedBatchId),
      )?.harvest || null,
    [batchesForSelection, selectedBatchId],
  );

  const harvestStrains = useMemo(() => {
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
    () =>
      harvestStrains.find((entry) => entry.key === selectedStrainKey) || null,
    [harvestStrains, selectedStrainKey],
  );

  // Reset form state when batch changes.
  const handleBatchChange = (e) => {
    setSelectedBatchId(e.target.value);
    setSelectedStrainKey(null);
    setDryWeightInput("");
    setDryWeightsByKey({});
  };

  const handleStrainClick = (strainKey) => {
    setSelectedStrainKey(strainKey);
    setDryWeightInput("");
  };

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

  // Save dry weights back to the harvest.
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

      const res = await fetch(`/api/harvests/${selectedHarvest._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooms: updatedRooms,
          finalizeDryWeights: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save dry weights");
      }

      await res.json();

      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      window.alert(`Error: ${error.message}`);
    }
  };

  const activeDryWeight = useMemo(
    () => (selectedStrain ? dryWeightsByKey[selectedStrain.key] : undefined),
    [dryWeightsByKey, selectedStrain],
  );

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      sx={{ height: "100%" }}
    >
      <Stack spacing={2} sx={{ width: { xs: "100%", md: 420 } }}>
        <Typography variant="h6">Dry Weight Entry</Typography>

        <TextField
          select
          label="Batch"
          value={selectedBatchId}
          onChange={handleBatchChange}
          SelectProps={{ MenuProps: SELECT_MENU_PROPS }}
        >
          <MenuItem value="">Select Batch</MenuItem>
          {batchesForSelection.map(({ batchId, batchNumber, harvest }) => {
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
          <Button variant="contained" size="large" onClick={handleSubmit}>
            Save Dry Weights
          </Button>
        )}
      </Stack>

      <Box sx={{ flex: 1 }}>
        <Card variant="outlined" sx={{ height: "100%" }}>
          <CardContent>
            {selectedStrain ? (
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
