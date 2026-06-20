const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Harvest = require("../models/Harvest");
const Batch = require("../models/Batch");
const Room = require("../models/Room");
const RoomAssignment = require("../models/RoomAssignment");
const { runWithOptionalTransaction } = require("../utils/transactionHelpers");
const { recordAudit } = require("../utils/recordAudit");

router.post("/", async (req, res) => {
  try {
    const { batchId, locationId, harvestNumber, rooms, harvestDate } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: "batchId is required" });
    }

    await Batch.updateMany(
      {
        tenantId: req.tenantId,
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
        const batchQuery = Batch.findOne({
          tenantId: req.tenantId,
          _id: batchId,
        });
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

        const normalizedRooms = Array.isArray(rooms) ? rooms : [];
        const uniqueRoomIds = [
          ...new Set(
            normalizedRooms
              .map((entry) => String(entry?.roomId || ""))
              .filter(Boolean),
          ),
        ];

        if (uniqueRoomIds.length > 0) {
          const roomQuery = Room.find({
            tenantId: req.tenantId,
            _id: { $in: uniqueRoomIds },
          }).select("_id locationId");

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

        const harvest = new Harvest({
          tenantId: req.tenantId,
          batchId,
          locationId,
          harvestNumber,
          rooms: normalizedRooms,
          harvestDate: harvestDate || Date.now(),
        });

        const savedHarvest = await harvest.save(
          session ? { session } : undefined,
        );

        const updatedBatch = await Batch.findOneAndUpdate(
          {
            tenantId: req.tenantId,
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
          if (session) {
            const conflictError = new Error(
              "This batch already has a harvest record",
            );
            conflictError.code = "BATCH_HARVEST_CONFLICT";
            throw conflictError;
          }

          await Harvest.findOneAndDelete({
            tenantId: req.tenantId,
            _id: savedHarvest._id,
          });

          return {
            status: 409,
            body: { error: "This batch already has a harvest record" },
          };
        }

        await RoomAssignment.updateMany(
          { tenantId: req.tenantId, batchId, active: true },
          { $set: { active: false, endedAt: new Date() } },
          session ? { session } : undefined,
        );

        return { status: 201, harvestId: savedHarvest._id };
      },
    );

    if (result?.body) {
      return res.status(result.status).json(result.body);
    }

    const populatedHarvest = await Harvest.findOne({
      tenantId: req.tenantId,
      _id: result.harvestId,
    }).populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);

    await recordAudit(req, {
      action: "create",
      resourceType: "harvest",
      resourceId: populatedHarvest._id,
      batchId: populatedHarvest.batchId?._id || populatedHarvest.batchId,
      summary: `Created harvest ${populatedHarvest.harvestNumber || populatedHarvest._id}`,
    });

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

router.get("/", async (req, res) => {
  try {
    const harvests = await Harvest.find({ tenantId: req.tenantId }).populate([
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

router.get("/:id", async (req, res) => {
  try {
    const harvest = await Harvest.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate([
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
        const harvestQuery = Harvest.findOne({
          tenantId: req.tenantId,
          _id: req.params.id,
        });

        if (session) harvestQuery.session(session);
        const harvest = await harvestQuery;

        if (!harvest) {
          return { status: 404, body: { error: "Harvest not found" } };
        }

        if (locationId !== undefined) harvest.locationId = locationId;
        if (harvestNumber !== undefined) harvest.harvestNumber = harvestNumber;
        if (rooms !== undefined) harvest.rooms = rooms;
        if (harvestDate !== undefined) harvest.harvestDate = harvestDate;

        const updatedHarvest = await harvest.save(
          session ? { session } : undefined,
        );

        if (finalizeDryWeights === true) {
          const batchQuery = Batch.findOne({
            tenantId: req.tenantId,
            _id: harvest.batchId,
          }).select("lifecycleStage");

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

          await Batch.findOneAndUpdate(
            { tenantId: req.tenantId, _id: harvest.batchId },
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

    const populatedHarvest = await Harvest.findOne({
      tenantId: req.tenantId,
      _id: result.harvestId,
    }).populate([
      "locationId",
      "batchId",
      "rooms.roomId",
      "rooms.strains.strainId",
    ]);

    await recordAudit(req, {
      action: "update",
      resourceType: "harvest",
      resourceId: populatedHarvest._id,
      batchId: populatedHarvest.batchId?._id || populatedHarvest.batchId,
      summary: finalizeDryWeights === true
        ? `Finalized dry weights for harvest ${populatedHarvest.harvestNumber || populatedHarvest._id}`
        : `Updated harvest ${populatedHarvest.harvestNumber || populatedHarvest._id}`,
    });

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
