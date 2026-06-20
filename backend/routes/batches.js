const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Batch = require("../models/Batch");
const Room = require("../models/Room");
const RoomAssignment = require("../models/RoomAssignment");
const {
  aggregatePlantTotalsMap,
  aggregateAssignmentTotalsMap,
  mapTotalsToPlants,
  normalizeRoomPlants,
  roomEntriesFromAssignments,
  subtractPlantsFromRooms,
} = require("../utils/plantHelpers");
const { runWithOptionalTransaction } = require("../utils/transactionHelpers");
const { recordAudit } = require("../utils/recordAudit");

// Populate strain details inside each batch room/plant entry.
const BATCH_POPULATE = "rooms.plants.strainId";

// Shared populate config for room assignment responses.
// This keeps room details, batch summary info, and strain details in one payload.
const ROOM_ASSIGNMENT_POPULATE = [
  {
    path: "roomId",
    populate: { path: "locationId" },
  },
  {
    path: "batchId",
    select:
      "batchNumber batchType cloneDate harvestDate location lifecycleStage stageStartedAt",
  },
  "assignedPlants.strainId",
];

// Defines the next lifecycle stage for each batch type.
// Example: a production batch moves Clone -> Veg -> Flower.
const NEXT_STAGE_BY_BATCH_TYPE = {
  production: {
    Clone: "Veg",
    Veg: "Flower",
    Flower: "HarvestReady",
  },
  mom: {
    Clone: "Veg",
    Veg: "Mom",
  },
};

// Promote production batches to HarvestReady once their harvest date is due.
async function autoPromoteDueBatchesToHarvestReady(tenantId, session = null) {
  const now = new Date();
  const query = {
    tenantId,
    batchType: "production",
    harvestId: null,
    harvestDate: { $ne: null, $lte: now },
    lifecycleStage: { $in: ["Clone", "Veg", "Flower"] },
  };

  const update = {
    $set: {
      lifecycleStage: "HarvestReady",
      stageStartedAt: now,
    },
  };

  if (session) {
    await Batch.updateMany(query, update, { session });
    return;
  }

  await Batch.updateMany(query, update);
}

// Get the current total plants for a batch by strain.
// Active room assignments are the main source of truth.
// If none exist yet, fall back to the batch's stored room data.
async function getCurrentBatchTotals(
  batchId,
  fallbackRooms,
  tenantId,
  session = null,
) {
  const assignmentQuery = RoomAssignment.find({
    tenantId,
    batchId,
    active: true,
  }).select("roomId assignedPlants");

  if (session) assignmentQuery.session(session);

  const activeAssignments = await assignmentQuery;

  if (activeAssignments.length === 0) {
    return aggregatePlantTotalsMap(fallbackRooms);
  }

  return aggregateAssignmentTotalsMap(activeAssignments);
}

// Replace each batch's rooms with rooms built from active assignments when available.
// This lets the API return the live room state without needing duplicate active data on Batch.
async function attachDerivedRoomsToBatches(batches, tenantId) {
  if (!Array.isArray(batches) || batches.length === 0) {
    return [];
  }

  const batchIds = batches.map((batch) => batch._id);
  const assignments = await RoomAssignment.find({
    tenantId,
    active: true,
    batchId: { $in: batchIds },
  })
    .select("batchId roomId assignedPlants")
    .populate("assignedPlants.strainId");

  const roomsByBatchId = new Map();

  assignments.forEach((assignment) => {
    const key = String(assignment.batchId);
    const existing = roomsByBatchId.get(key) || [];

    existing.push({
      roomId: assignment.roomId,
      plants: assignment.assignedPlants,
    });

    roomsByBatchId.set(key, existing);
  });

  return batches.map((batch) => {
    const batchObject =
      typeof batch.toObject === "function" ? batch.toObject() : { ...batch };
    const derivedRooms = roomsByBatchId.get(String(batch._id));

    if (Array.isArray(derivedRooms) && derivedRooms.length > 0) {
      batchObject.rooms = derivedRooms;
    }

    return batchObject;
  });
}

// Build a unique batch number for new mom batches.
// It re-tries with a timestamp-based suffix until it finds an unused value.
async function buildUniqueMomBatchNumber(
  baseBatchNumber,
  tenantId,
  session = null,
) {
  const normalizedBase = baseBatchNumber || "BATCH";

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const suffix = `${Date.now()}-${attempt}`;
    const candidate = `${normalizedBase}-MOM-${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const existsQuery = Batch.exists({ tenantId, batchNumber: candidate });
    if (session) existsQuery.session(session);
    // eslint-disable-next-line no-await-in-loop
    const exists = await existsQuery;
    if (!exists) return candidate;
  }

  throw new Error("Unable to generate a unique mom batch number");
}

// New batches start in the Clone room at the chosen location.
async function findCloneRoom(tenantId, locationId) {
  return Room.findOne({
    tenantId,
    locationId,
    type: "Clone",
  }).sort({ createdAt: 1 });
}

// Batch create/read and movement endpoints.
// Always include tenantId: req.tenantId in every database query.

// POST /api/batches — create a new batch.
router.post("/", async (req, res) => {
  try {
    const {
      batchNumber,
      cloneDate,
      harvestDate,
      location,
      rooms,
      batchType,
      plants,
    } = req.body;

    if (!batchNumber || !cloneDate) {
      return res
        .status(400)
        .json({ error: "batchNumber and cloneDate are required" });
    }

    const startedAt = new Date(cloneDate);
    let batchRooms = Array.isArray(rooms) ? rooms : [];
    let cloneRoom = null;
    const hasPlants = Array.isArray(plants) && plants.length > 0;

    // When plants are included, put the batch in that location's Clone room.
    if (hasPlants) {
      if (!location) {
        return res.status(400).json({
          error: "location is required when creating a batch with plants",
        });
      }

      cloneRoom = await findCloneRoom(req.tenantId, location);

      if (!cloneRoom) {
        return res.status(400).json({
          error: "No Clone room found at the selected location",
        });
      }

      batchRooms = [{ roomId: cloneRoom._id, plants }];
    }

    const savedBatch = await Batch.create({
      tenantId: req.tenantId,
      batchNumber,
      cloneDate,
      harvestDate: harvestDate || null,
      location: location || null,
      rooms: batchRooms,
      batchType: batchType || "production",
      lifecycleStage: "Clone",
      stageStartedAt: startedAt,
    });

    if (cloneRoom) {
      await RoomAssignment.create({
        tenantId: req.tenantId,
        batchId: savedBatch._id,
        roomId: cloneRoom._id,
        assignedPlants: plants,
        active: true,
        source: "manual",
        startedAt,
      });
    }

    const batchDoc = await Batch.findOne({
      tenantId: req.tenantId,
      _id: savedBatch._id,
    }).populate(BATCH_POPULATE);

    const [populatedBatch] = await attachDerivedRoomsToBatches(
      [batchDoc],
      req.tenantId,
    );

    await recordAudit(req, {
      action: "create",
      resourceType: "batch",
      resourceId: savedBatch._id,
      batchId: savedBatch._id,
      summary: `Created batch ${savedBatch.batchNumber}`,
    });

    res.status(201).json(populatedBatch);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Batch number must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// GET /api/batches — list all batches for this tenant.
router.get("/", async (req, res) => {
  try {
    await autoPromoteDueBatchesToHarvestReady(req.tenantId);

    const batches = await Batch.find({ tenantId: req.tenantId }).populate(
      BATCH_POPULATE,
    );
    const hydrated = await attachDerivedRoomsToBatches(batches, req.tenantId);
    res.json(hydrated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/batches/:id/move — move a batch to a room and advance its stage.
router.post("/:id/move", async (req, res) => {
  try {
    const { roomId, notes } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }

    const [batch, room] = await Promise.all([
      Batch.findOne({ tenantId: req.tenantId, _id: req.params.id }),
      Room.findOne({ tenantId: req.tenantId, _id: roomId }),
    ]);

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const stageMap =
      NEXT_STAGE_BY_BATCH_TYPE[batch.batchType] ||
      NEXT_STAGE_BY_BATCH_TYPE.production;
    const nextStage = stageMap[batch.lifecycleStage];

    if (!nextStage) {
      return res.status(400).json({
        error: `No next stage available from ${batch.lifecycleStage}`,
      });
    }

    const { savedAssignmentId } = await runWithOptionalTransaction(
      mongoose,
      async (session) => {
        const now = new Date();

        // Close any current active room placements for this batch.
        await RoomAssignment.updateMany(
          { tenantId: req.tenantId, batchId: batch._id, active: true },
          { $set: { active: false, endedAt: now } },
          session ? { session } : undefined,
        );

        const assignment = new RoomAssignment({
          tenantId: req.tenantId,
          batchId: batch._id,
          roomId,
          assignedPlants: mapTotalsToPlants(
            await getCurrentBatchTotals(
              batch._id,
              batch.rooms,
              req.tenantId,
              session,
            ),
          ),
          active: true,
          source: "manual",
          startedAt: now,
          endedAt: null,
          notes: notes || null,
        });

        const savedAssignment = await assignment.save(
          session ? { session } : undefined,
        );

        // Moving also advances the lifecycle stage.
        batch.lifecycleStage = nextStage;
        batch.stageStartedAt = now;
        await batch.save(session ? { session } : undefined);

        return { savedAssignmentId: savedAssignment._id };
      },
    );

    const [batchDoc, populatedAssignment] = await Promise.all([
      Batch.findOne({ tenantId: req.tenantId, _id: batch._id }).populate(
        BATCH_POPULATE,
      ),
      RoomAssignment.findOne({
        tenantId: req.tenantId,
        _id: savedAssignmentId,
      }).populate([
        {
          path: "roomId",
          populate: { path: "locationId" },
        },
        {
          path: "batchId",
          select:
            "batchNumber batchType cloneDate harvestDate location lifecycleStage stageStartedAt",
        },
        "assignedPlants.strainId",
      ]),
    ]);

    const [populatedBatch] = await attachDerivedRoomsToBatches(
      [batchDoc],
      req.tenantId,
    );

    await recordAudit(req, {
      action: "update",
      resourceType: "batch",
      resourceId: batch._id,
      batchId: batch._id,
      summary: `Moved batch ${populatedBatch?.batchNumber || batch.batchNumber} to ${populatedAssignment?.roomId?.name || "room"} (${populatedBatch?.lifecycleStage})`,
    });

    res.status(201).json({
      batch: populatedBatch,
      assignment: populatedAssignment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign batch to one room or split across rooms.
router.post("/:id/assign-rooms", async (req, res) => {
  try {
    const {
      mode,
      roomId,
      assignments,
      plants,
      notes,
      advanceStage,
      destroyUnallocated,
    } = req.body;

    const batch = await Batch.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    });
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const currentTotals = await getCurrentBatchTotals(
      batch._id,
      batch.rooms,
      req.tenantId,
    );
    const normalizedMode = mode === "split" ? "split" : "whole";

    let normalizedAssignments = [];

    if (normalizedMode === "whole") {
      if (!roomId) {
        return res.status(400).json({ error: "roomId is required" });
      }

      if (destroyUnallocated === true) {
        const requestedPlants = (Array.isArray(plants) ? plants : [])
          .map((plant) => ({
            strainId: String(plant?.strainId || ""),
            count: Number(plant?.count) || 0,
          }))
          .filter((plant) => plant.strainId && plant.count > 0);

        if (requestedPlants.length === 0) {
          return res.status(400).json({
            error:
              "plants are required when destroyUnallocated is enabled in whole mode",
          });
        }

        const requestedTotals = new Map();
        requestedPlants.forEach((plant) => {
          requestedTotals.set(
            plant.strainId,
            (requestedTotals.get(plant.strainId) || 0) + plant.count,
          );
        });

        const exceedsAvailable = Array.from(requestedTotals.entries()).find(
          ([strainId, count]) => count > (currentTotals.get(strainId) || 0),
        );

        if (exceedsAvailable) {
          return res.status(400).json({
            error:
              "Requested move count cannot exceed available plants for any strain",
          });
        }

        normalizedAssignments = [
          {
            roomId,
            plants: Array.from(requestedTotals.entries()).map(
              ([strainId, count]) => ({
                strainId,
                count,
              }),
            ),
          },
        ];
      } else {
        // Whole mode sends the full batch into one room.
        normalizedAssignments = [
          {
            roomId,
            plants: Array.from(currentTotals.entries()).map(
              ([strainId, count]) => ({
                strainId,
                count,
              }),
            ),
          },
        ];
      }
    } else {
      // Split mode lets the user divide the batch across multiple rooms.
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res
          .status(400)
          .json({ error: "assignments are required for split mode" });
      }

      normalizedAssignments = assignments
        .filter((entry) => entry?.roomId)
        .map((entry) => ({
          roomId: entry.roomId,
          plants: (Array.isArray(entry?.plants) ? entry.plants : [])
            .map((plant) => ({
              strainId: String(plant?.strainId || ""),
              count: Number(plant?.count) || 0,
            }))
            .filter((plant) => plant.strainId && plant.count > 0),
        }))
        .filter((entry) => entry.plants.length > 0);

      if (normalizedAssignments.length === 0) {
        return res.status(400).json({ error: "No split allocations were set" });
      }

      // Validate split against available totals. By default it must account for everything.
      const proposedTotals = new Map();
      normalizedAssignments.forEach((entry) => {
        entry.plants.forEach((plant) => {
          proposedTotals.set(
            plant.strainId,
            (proposedTotals.get(plant.strainId) || 0) + plant.count,
          );
        });
      });

      const exceedsAvailable = Array.from(proposedTotals.entries()).find(
        ([strainId, count]) => count > (currentTotals.get(strainId) || 0),
      );

      if (exceedsAvailable) {
        return res.status(400).json({
          error:
            "Split allocation cannot exceed current total plant counts for any strain",
        });
      }

      if (destroyUnallocated !== true) {
        const sameKeyCount = proposedTotals.size === currentTotals.size;
        const sameCounts = Array.from(currentTotals.entries()).every(
          ([strainId, count]) => proposedTotals.get(strainId) === count,
        );

        if (!sameKeyCount || !sameCounts) {
          return res.status(400).json({
            error:
              "Split allocation must account for every strain and match current total plant counts",
          });
        }
      }
    }

    const uniqueRoomIds = [
      ...new Set(normalizedAssignments.map((entry) => String(entry.roomId))),
    ];

    const roomDocs = await Room.find({
      tenantId: req.tenantId,
      _id: { $in: uniqueRoomIds },
    }).select("_id locationId");

    if (roomDocs.length !== uniqueRoomIds.length) {
      return res
        .status(400)
        .json({ error: "One or more selected rooms are invalid" });
    }

    if (batch.location) {
      const badRoom = roomDocs.find(
        (roomDoc) => String(roomDoc.locationId) !== String(batch.location),
      );

      if (badRoom) {
        return res.status(400).json({
          error: "All selected rooms must belong to the batch location",
        });
      }
    }

    const { savedAssignmentIds } = await runWithOptionalTransaction(
      mongoose,
      async (session) => {
        const now = new Date();

        // End current active assignments before writing the new room layout.
        await RoomAssignment.updateMany(
          { tenantId: req.tenantId, batchId: batch._id, active: true },
          { $set: { active: false, endedAt: now } },
          session ? { session } : undefined,
        );

        const savedAssignments = await RoomAssignment.insertMany(
          uniqueRoomIds.map((id) => {
            const roomAssignmentEntry = normalizedAssignments.find(
              (entry) => String(entry.roomId) === String(id),
            );

            return {
              tenantId: req.tenantId,
              batchId: batch._id,
              roomId: id,
              assignedPlants: roomAssignmentEntry?.plants || [],
              active: true,
              source: "manual",
              startedAt: now,
              endedAt: null,
              notes: notes || null,
            };
          }),
          session ? { session } : undefined,
        );

        if (advanceStage === true) {
          // Optionally advance the batch stage as part of the room move.
          const stageMap =
            NEXT_STAGE_BY_BATCH_TYPE[batch.batchType] ||
            NEXT_STAGE_BY_BATCH_TYPE.production;
          const nextStage = stageMap[batch.lifecycleStage];

          if (!nextStage) {
            throw new Error(
              `No next stage available from ${batch.lifecycleStage}`,
            );
          }

          batch.lifecycleStage = nextStage;
          batch.stageStartedAt = now;
        }

        if (advanceStage === true) {
          await batch.save(session ? { session } : undefined);
        }

        return {
          savedAssignmentIds: savedAssignments.map((entry) => entry._id),
        };
      },
    );

    const [updatedBatchDoc, populatedAssignments] = await Promise.all([
      Batch.findOne({ tenantId: req.tenantId, _id: batch._id }).populate(
        BATCH_POPULATE,
      ),
      RoomAssignment.find({
        tenantId: req.tenantId,
        _id: { $in: savedAssignmentIds },
      }).populate(ROOM_ASSIGNMENT_POPULATE),
    ]);

    const [updatedBatch] = await attachDerivedRoomsToBatches(
      [updatedBatchDoc],
      req.tenantId,
    );

    await recordAudit(req, {
      action: "update",
      resourceType: "batch",
      resourceId: batch._id,
      batchId: batch._id,
      summary: `Assigned batch ${updatedBatch?.batchNumber || batch.batchNumber} to room(s)`,
    });

    res.status(201).json({
      batch: updatedBatch,
      assignments: populatedAssignments,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error:
          "Conflicting active room assignment was detected. Refresh and try again.",
      });
    }

    if (String(error?.message || "").startsWith("No next stage available")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

// Create a mom batch from selected plants in a production batch.
router.post("/:id/create-moms", async (req, res) => {
  try {
    const { plants, momRoomId, notes } = req.body;

    const sourceBatch = await Batch.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate(BATCH_POPULATE);
    if (!sourceBatch) {
      return res.status(404).json({ error: "Source batch not found" });
    }

    if (sourceBatch.batchType !== "production") {
      return res.status(400).json({
        error: "Only production batches can be used to create mom batches",
      });
    }

    if (sourceBatch.lifecycleStage !== "Veg") {
      return res.status(400).json({
        error:
          "Only production batches in Veg stage can be used to create mom batches",
      });
    }

    if (!Array.isArray(plants) || plants.length === 0) {
      return res.status(400).json({
        error: "plants array is required to create a mom batch",
      });
    }

    // Figure out how many plants are currently available to cut from the source batch.
    const availableTotals = await getCurrentBatchTotals(
      sourceBatch._id,
      sourceBatch.rooms,
      req.tenantId,
    );
    const requestedCuts = new Map();

    plants.forEach((entry) => {
      const strainId = String(entry?.strainId || "");
      const count = Number(entry?.count) || 0;
      if (!strainId || count <= 0) return;
      requestedCuts.set(strainId, (requestedCuts.get(strainId) || 0) + count);
    });

    if (requestedCuts.size === 0) {
      return res.status(400).json({
        error: "At least one positive strain cut count is required",
      });
    }

    const overdrawn = Array.from(requestedCuts.entries()).find(
      ([strainId, cutCount]) => cutCount > (availableTotals.get(strainId) || 0),
    );

    if (overdrawn) {
      return res.status(400).json({
        error: "Requested mom cut exceeds available plants in source batch",
      });
    }

    let momRoom = null;

    if (momRoomId) {
      momRoom = await Room.findOne({
        tenantId: req.tenantId,
        _id: momRoomId,
      });
      if (!momRoom) {
        return res.status(404).json({ error: "Selected mom room not found" });
      }
    } else {
      momRoom = await Room.findOne({
        tenantId: req.tenantId,
        locationId: sourceBatch.location,
        type: "Mom",
      });
      if (!momRoom) {
        return res.status(400).json({
          error: "No mom room found at source batch location",
        });
      }
    }

    if (String(momRoom.locationId) !== String(sourceBatch.location)) {
      return res.status(400).json({
        error: "Mom room must belong to the same location as source batch",
      });
    }

    const { savedMomBatchId, momAssignmentId } =
      await runWithOptionalTransaction(mongoose, async (session) => {
        const now = new Date();

        // Load active assignments so the cut is based on the live room layout.
        const activeAssignmentsQuery = RoomAssignment.find({
          tenantId: req.tenantId,
          batchId: sourceBatch._id,
          active: true,
        });
        if (session) activeAssignmentsQuery.session(session);
        const activeSourceAssignments = await activeAssignmentsQuery;

        const sourceRoomEntries =
          activeSourceAssignments.length > 0
            ? roomEntriesFromAssignments(activeSourceAssignments)
            : normalizeRoomPlants(sourceBatch.rooms);

        // Remove the requested mom cuts from the source batch room totals.
        const updatedSourceRooms = subtractPlantsFromRooms(
          sourceRoomEntries,
          requestedCuts,
        );
        const momPlants = mapTotalsToPlants(requestedCuts);

        if (activeSourceAssignments.length === 0) {
          // If the batch has no active assignments yet, fall back to saving on Batch.rooms.
          sourceBatch.rooms = updatedSourceRooms;
          await sourceBatch.save(session ? { session } : undefined);
        }

        const momBatchNumber = await buildUniqueMomBatchNumber(
          sourceBatch.batchNumber,
          req.tenantId,
          session,
        );

        const momBatch = new Batch({
          tenantId: req.tenantId,
          batchNumber: momBatchNumber,
          cloneDate: now,
          harvestDate: null,
          batchType: "mom",
          location: sourceBatch.location,
          rooms: [
            {
              roomId: momRoom._id,
              plants: momPlants,
            },
          ],
          lifecycleStage: "Mom",
          stageStartedAt: now,
        });
        const savedMomBatch = await momBatch.save(
          session ? { session } : undefined,
        );

        if (activeSourceAssignments.length > 0) {
          // Update the source batch's active room assignments after the cut.
          await RoomAssignment.bulkWrite(
            activeSourceAssignments.map((assignment) => {
              const roomEntry = updatedSourceRooms.find(
                (entry) => String(entry.roomId) === String(assignment.roomId),
              );

              return {
                updateOne: {
                  filter: { _id: assignment._id },
                  update: {
                    $set: roomEntry
                      ? {
                          assignedPlants: roomEntry.plants,
                        }
                      : {
                          assignedPlants: [],
                          active: false,
                          endedAt: now,
                        },
                  },
                },
              };
            }),
            session ? { session } : undefined,
          );
        }

        // Create the first active room assignment for the new mom batch.
        const momAssignment = new RoomAssignment({
          tenantId: req.tenantId,
          batchId: savedMomBatch._id,
          roomId: momRoom._id,
          assignedPlants: momPlants,
          active: true,
          source: "manual",
          startedAt: now,
          endedAt: null,
          notes: notes || "Created from production batch mom cut",
        });

        const savedMomAssignment = await momAssignment.save(
          session ? { session } : undefined,
        );

        return {
          savedMomBatchId: savedMomBatch._id,
          momAssignmentId: savedMomAssignment._id,
        };
      });

    const [sourceBatchDoc, momBatchDoc, populatedMomAssignment] =
      await Promise.all([
        Batch.findOne({ tenantId: req.tenantId, _id: sourceBatch._id }).populate(
          BATCH_POPULATE,
        ),
        Batch.findOne({ tenantId: req.tenantId, _id: savedMomBatchId }).populate(
          BATCH_POPULATE,
        ),
        RoomAssignment.findOne({
          tenantId: req.tenantId,
          _id: momAssignmentId,
        }).populate(ROOM_ASSIGNMENT_POPULATE),
      ]);

    const [updatedSourceBatch, populatedMomBatch] =
      await attachDerivedRoomsToBatches(
        [sourceBatchDoc, momBatchDoc],
        req.tenantId,
      );

    await recordAudit(req, {
      action: "create",
      resourceType: "batch",
      resourceId: populatedMomBatch?._id || momBatchDoc._id,
      batchId: updatedSourceBatch?._id || sourceBatchDoc._id,
      summary: `Created mom batch ${populatedMomBatch?.batchNumber || "from source batch"}`,
    });

    res.status(201).json({
      sourceBatch: updatedSourceBatch,
      momBatch: populatedMomBatch,
      momAssignment: populatedMomAssignment,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error:
          "A conflicting active assignment or mom batch number was detected. Refresh and try again.",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// Remove (destroy) plants from a batch for one strain.
router.post("/:id/destroy-plants", async (req, res) => {
  try {
    const { strainId, count, notes } = req.body;

    const normalizedStrainId = String(strainId || "").trim();
    const removeCount = Number(count);

    if (!normalizedStrainId) {
      return res.status(400).json({ error: "strainId is required" });
    }

    if (!Number.isFinite(removeCount) || removeCount <= 0) {
      return res.status(400).json({ error: "count must be a positive number" });
    }

    const batch = await Batch.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate(BATCH_POPULATE);
    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const currentTotals = await getCurrentBatchTotals(
      batch._id,
      batch.rooms,
      req.tenantId,
    );
    const available = currentTotals.get(normalizedStrainId) || 0;

    if (available < removeCount) {
      return res.status(400).json({
        error: `Cannot remove ${removeCount}. Only ${available} available for selected strain.`,
      });
    }

    const { changedAssignmentIds } = await runWithOptionalTransaction(
      mongoose,
      async (session) => {
        const now = new Date();

        const activeAssignmentsQuery = RoomAssignment.find({
          tenantId: req.tenantId,
          batchId: batch._id,
          active: true,
        }).sort({ createdAt: 1 });

        if (session) activeAssignmentsQuery.session(session);
        const activeAssignments = await activeAssignmentsQuery;

        let remaining = removeCount;
        const changedAssignmentIdsLocal = [];

        if (activeAssignments.length > 0) {
          const bulkUpdates = [];

          activeAssignments.forEach((assignment) => {
            if (remaining <= 0) return;

            const assignedPlants = Array.isArray(assignment.assignedPlants)
              ? assignment.assignedPlants.map((plant) => ({
                  strainId: plant.strainId,
                  count: Number(plant.count) || 0,
                }))
              : [];

            let assignmentChanged = false;

            const updatedPlants = assignedPlants
              .map((plant) => {
                const thisStrainId = String(plant.strainId || "");
                if (thisStrainId !== normalizedStrainId || remaining <= 0) {
                  return plant;
                }

                const removable = Math.min(plant.count, remaining);
                remaining -= removable;
                assignmentChanged = true;

                return {
                  ...plant,
                  count: plant.count - removable,
                };
              })
              .filter((plant) => plant.count > 0);

            if (!assignmentChanged) return;

            changedAssignmentIdsLocal.push(assignment._id);

            if (updatedPlants.length === 0) {
              bulkUpdates.push({
                updateOne: {
                  filter: { _id: assignment._id },
                  update: {
                    $set: {
                      assignedPlants: [],
                      active: false,
                      endedAt: now,
                      notes:
                        notes ||
                        "Automatically closed after plant destruction removed all plants",
                    },
                  },
                },
              });
              return;
            }

            bulkUpdates.push({
              updateOne: {
                filter: { _id: assignment._id },
                update: {
                  $set: {
                    assignedPlants: updatedPlants,
                    notes: notes || assignment.notes || null,
                  },
                },
              },
            });
          });

          if (remaining > 0) {
            throw new Error("Unable to allocate requested destruction amount");
          }

          if (bulkUpdates.length > 0) {
            await RoomAssignment.bulkWrite(
              bulkUpdates,
              session ? { session } : undefined,
            );
          }

          const refreshedAssignmentsQuery = RoomAssignment.find({
            tenantId: req.tenantId,
            batchId: batch._id,
            active: true,
          }).select("roomId assignedPlants");
          if (session) refreshedAssignmentsQuery.session(session);
          const refreshedAssignments = await refreshedAssignmentsQuery;

          batch.rooms = roomEntriesFromAssignments(refreshedAssignments);
          await batch.save(session ? { session } : undefined);

          return { changedAssignmentIds: changedAssignmentIdsLocal };
        }

        const updatedRooms = normalizeRoomPlants(batch.rooms)
          .map((roomEntry) => {
            const nextPlants = (
              Array.isArray(roomEntry?.plants) ? roomEntry.plants : []
            )
              .map((plantEntry) => {
                const thisStrainId = String(
                  plantEntry?.strainId?._id || plantEntry?.strainId || "",
                );

                if (thisStrainId !== normalizedStrainId || remaining <= 0) {
                  return {
                    strainId: plantEntry.strainId,
                    count: Number(plantEntry.count) || 0,
                  };
                }

                const plantCount = Number(plantEntry.count) || 0;
                const removable = Math.min(plantCount, remaining);
                remaining -= removable;

                return {
                  strainId: plantEntry.strainId,
                  count: plantCount - removable,
                };
              })
              .filter((plant) => plant.count > 0);

            return {
              roomId: roomEntry.roomId,
              plants: nextPlants,
            };
          })
          .filter((roomEntry) => roomEntry.plants.length > 0);

        if (remaining > 0) {
          throw new Error("Unable to allocate requested destruction amount");
        }

        batch.rooms = updatedRooms;
        await batch.save(session ? { session } : undefined);

        return { changedAssignmentIds: [] };
      },
    );

    const [updatedBatchDoc, changedAssignments] = await Promise.all([
      Batch.findOne({ tenantId: req.tenantId, _id: batch._id }).populate(
        BATCH_POPULATE,
      ),
      changedAssignmentIds.length > 0
        ? RoomAssignment.find({
            tenantId: req.tenantId,
            _id: { $in: changedAssignmentIds },
          }).populate(ROOM_ASSIGNMENT_POPULATE)
        : Promise.resolve([]),
    ]);

    const [updatedBatch] = await attachDerivedRoomsToBatches(
      [updatedBatchDoc],
      req.tenantId,
    );

    await recordAudit(req, {
      action: "update",
      resourceType: "batch",
      resourceId: batch._id,
      batchId: batch._id,
      summary: `Removed ${removeCount} plants from batch ${updatedBatch?.batchNumber || batch.batchNumber}`,
    });

    res.status(200).json({
      batch: updatedBatch,
      assignments: changedAssignments,
      removed: {
        strainId: normalizedStrainId,
        count: removeCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one batch.
router.get("/:id", async (req, res) => {
  try {
    await autoPromoteDueBatchesToHarvestReady(req.tenantId);

    const batchDoc = await Batch.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    }).populate(BATCH_POPULATE);
    if (!batchDoc) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const [batch] = await attachDerivedRoomsToBatches(
      [batchDoc],
      req.tenantId,
    );
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
