const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Harvest = require("../models/Harvest");
const Batch = require("../models/Batch");
const Room = require("../models/Room");
const RoomAssignment = require("../models/RoomAssignment");
const { runWithOptionalTransaction } = require("../utils/transactionHelpers");

// Harvest create/read/update endpoints.

// Create harvest.
router.post("/", async (req, res) => {
  try {
    const { batchId, locationId, harvestNumber, rooms, harvestDate } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: "batchId is required" });
    }

    await Batch.updateMany(
      {
        batchType: "production",
        harvestId: null,
        harvestDate: { $ne: null, $lte: new Date() },
        lifecycleStage: { $in: ["Clone", "Veg", "Flower"] },
      },
      {
        $set: {
          lifecycleStage: "HarvestReady",
          stageStartedAt: new Date(),
        },
      },
    );

    const result = await runWithOptionalTransaction(
      mongoose,
      async (session) => {
        // Load the source batch first so we can validate that it exists
        // and confirm it has not already been harvested.
        const batchQuery = Batch.findById(batchId);
        if (session) batchQuery.session(session);
        const batch = await batchQuery;

        if (!batch) {
          return { status: 404, body: { error: "Batch not found" } };
        }

        if (batch.harvestId) {
          return {
            status: 409,
            body: { error: "This batch already has a harvest record" },
          };
        }

        if (batch.lifecycleStage !== "HarvestReady") {
          return {
            status: 400,
            body: {
              error:
                "Only batches in HarvestReady lifecycle stage can be harvested",
            },
          };
        }

        // Always work with a clean array, even if the client sends nothing.
        const normalizedRooms = Array.isArray(rooms) ? rooms : [];
        const uniqueRoomIds = [
          ...new Set(
            normalizedRooms
              .map((entry) => String(entry?.roomId || ""))
              .filter(Boolean),
          ),
        ];

        if (uniqueRoomIds.length > 0) {
          // Validate that every selected room exists and belongs to the
          // expected location for this batch/harvest.
          const roomQuery = Room.find({ _id: { $in: uniqueRoomIds } }).select(
            "_id locationId",
          );
          if (session) roomQuery.session(session);
          const roomDocs = await roomQuery;

          if (roomDocs.length !== uniqueRoomIds.length) {
            return {
              status: 400,
              body: { error: "One or more selected rooms are invalid" },
            };
          }

          if (batch.location) {
            const offLocationRoom = roomDocs.find(
              (roomDoc) =>
                String(roomDoc.locationId) !== String(batch.location),
            );

            if (offLocationRoom) {
              return {
                status: 400,
                body: {
                  error: "All harvest rooms must belong to the batch location",
                },
              };
            }
          }

          if (locationId) {
            const badLocationRoom = roomDocs.find(
              (roomDoc) => String(roomDoc.locationId) !== String(locationId),
            );

            if (badLocationRoom) {
              return {
                status: 400,
                body: {
                  error:
                    "Provided locationId must match every selected harvest room",
                },
              };
            }
          }
        }

        // Create the harvest record. The Harvest model calculates its own
        // totals and derived metrics before save.
        const harvest = new Harvest({
          batchId,
          locationId,
          harvestNumber,
          rooms: normalizedRooms,
          harvestDate: harvestDate || Date.now(),
        });

        const savedHarvest = await harvest.save(
          session ? { session } : undefined,
        );

        // Claim the batch only if it still has no harvest.
        // This prevents two concurrent requests from creating two harvests.
        const updatedBatch = await Batch.findOneAndUpdate(
          {
            _id: batchId,
            harvestId: null,
          },
          {
            harvestId: savedHarvest._id,
            lifecycleStage: "Drying",
            stageStartedAt: new Date(),
          },
          session ? { session, new: true } : { new: true },
        );

        if (!updatedBatch) {
          // In non-transaction fallback mode, delete the harvest we just made
          // so we do not leave behind an orphaned duplicate record.
          if (session) {
            const conflictError = new Error(
              "This batch already has a harvest record",
            );
            conflictError.code = "BATCH_HARVEST_CONFLICT";
            throw conflictError;
          }

          await Harvest.findByIdAndDelete(savedHarvest._id);
          return {
            status: 409,
            body: { error: "This batch already has a harvest record" },
          };
        }

        // Harvesting ends any active room assignments for that batch.
        await RoomAssignment.updateMany(
          { batchId, active: true },
          { $set: { active: false, endedAt: new Date() } },
          session ? { session } : undefined,
        );

        return { status: 201, harvestId: savedHarvest._id };
      },
    );

    if (result?.body) {
      return res.status(result.status).json(result.body);
    }

    // Load readable room/strain/location data for the frontend response.
    const populatedHarvest = await Harvest.findById(result.harvestId).populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    res.status(201).json(populatedHarvest);
  } catch (error) {
    if (error?.code === 11000) {
      if (error?.keyPattern?.batchId) {
        return res.status(409).json({
          error: "This batch already has a harvest record",
        });
      }

      return res.status(400).json({
        error: "Harvest number must be unique",
      });
    }

    if (error?.code === "BATCH_HARVEST_CONFLICT") {
      return res.status(409).json({
        error: error.message,
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// List harvests.
router.get("/", async (req, res) => {
  try {
    // Return all harvests with related location, batch, room, and strain info.
    const harvests = await Harvest.find().populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    res.json(harvests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one harvest.
router.get("/:id", async (req, res) => {
  try {
    // Return one full harvest record with all related references populated.
    const harvest = await Harvest.findById(req.params.id).populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    if (!harvest) {
      return res.status(404).json({ error: "Harvest not found" });
    }
    res.json(harvest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Patch harvest fields.
router.patch("/:id", async (req, res) => {
  try {
    const {
      locationId,
      harvestNumber,
      rooms,
      harvestDate,
      finalizeDryWeights,
    } = req.body;

    const result = await runWithOptionalTransaction(
      mongoose,
      async (session) => {
        // Load the existing harvest so we can update only the fields the client sent.
        const harvestQuery = Harvest.findById(req.params.id);
        if (session) harvestQuery.session(session);
        const harvest = await harvestQuery;

        if (!harvest) {
          return { status: 404, body: { error: "Harvest not found" } };
        }

        // Update only fields sent by the client.
        if (locationId !== undefined) harvest.locationId = locationId;
        if (harvestNumber !== undefined) harvest.harvestNumber = harvestNumber;
        if (rooms !== undefined) harvest.rooms = rooms;
        if (harvestDate !== undefined) harvest.harvestDate = harvestDate;

        // Saving re-runs the Harvest model calculations so totals stay in sync.
        const updatedHarvest = await harvest.save(
          session ? { session } : undefined,
        );

        if (finalizeDryWeights === true) {
          const batchQuery = Batch.findById(harvest.batchId).select(
            "lifecycleStage",
          );
          if (session) batchQuery.session(session);
          const sourceBatch = await batchQuery;

          if (!sourceBatch) {
            return { status: 404, body: { error: "Batch not found" } };
          }

          if (sourceBatch.lifecycleStage !== "Drying") {
            return {
              status: 400,
              body: {
                error:
                  "Dry weights can only be finalized for batches currently in Drying stage",
              },
            };
          }

          // Once dry weights are finalized, mark the source batch as completed.
          await Batch.findByIdAndUpdate(
            harvest.batchId,
            {
              lifecycleStage: "Completed",
              stageStartedAt: new Date(),
            },
            session ? { session } : undefined,
          );
        }

        return { status: 200, harvestId: updatedHarvest._id };
      },
    );

    if (result?.body) {
      return res.status(result.status).json(result.body);
    }

    // Return the updated harvest with readable related data.
    const populatedHarvest = await Harvest.findById(result.harvestId).populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);
    res.json(populatedHarvest);
  } catch (error) {
    if (error?.code === 11000) {
      if (error?.keyPattern?.batchId) {
        return res.status(409).json({
          error: "This batch already has a harvest record",
        });
      }

      return res.status(400).json({
        error: "Harvest number must be unique",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
