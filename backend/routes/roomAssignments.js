/**
 * Room assignment API — which batch is in which room.
 * Always include tenantId: req.tenantId in every database query.
 */

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Batch = require("../models/Batch");
const Room = require("../models/Room");
const RoomAssignment = require("../models/RoomAssignment");
const {
  aggregateAssignmentTotalsMap,
  aggregatePlantTotalsMap,
  mapTotalsToPlants,
} = require("../utils/plantHelpers");
const { runWithOptionalTransaction } = require("../utils/transactionHelpers");
const { recordAudit } = require("../utils/recordAudit");

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

// GET /api/room-assignments — list assignments (active only by default).
router.get("/", async (req, res) => {
  try {
    const activeOnly = req.query.active !== "false";

    // Always filter by tenantId so we only return this org's assignments.
    const filter = activeOnly
      ? { tenantId: req.tenantId, active: true }
      : { tenantId: req.tenantId };

    const assignments = await RoomAssignment.find(filter)
      .sort({ createdAt: -1 })
      .populate(ROOM_ASSIGNMENT_POPULATE);

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { batchId, roomId, source, notes } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }

    const normalizedBatchId =
      typeof batchId === "string" ? batchId.trim() : batchId;

    const result = await runWithOptionalTransaction(
      mongoose,
      async (session) => {
        const roomQuery = Room.findOne({
          tenantId: req.tenantId,
          _id: roomId,
        });
        if (session) roomQuery.session(session);
        const room = await roomQuery;

        if (!room) {
          return { status: 404, body: { error: "Room not found" } };
        }

        if (!normalizedBatchId) {
          const now = new Date();

          const unassignResult = await RoomAssignment.updateMany(
            { tenantId: req.tenantId, roomId, active: true },
            { $set: { active: false, endedAt: now } },
            session ? { session } : undefined,
          );

          return {
            status: 200,
            body: {
              roomId,
              batchId: null,
              active: false,
              source: source || "manual",
              notes: notes || null,
              endedAt: now,
              modifiedCount: unassignResult.modifiedCount,
            },
          };
        }

        const batchQuery = Batch.findOne({
          tenantId: req.tenantId,
          _id: normalizedBatchId,
        });
        if (session) batchQuery.session(session);
        const batch = await batchQuery;

        if (!batch) {
          return { status: 404, body: { error: "Batch not found" } };
        }

        if (
          batch.location &&
          String(batch.location) !== String(room.locationId)
        ) {
          return {
            status: 400,
            body: {
              error:
                "Selected room must belong to the same location as the batch",
            },
          };
        }

        const now = new Date();

        const activeAssignmentsQuery = RoomAssignment.find({
          tenantId: req.tenantId,
          batchId: normalizedBatchId,
          active: true,
        }).select("assignedPlants");

        if (session) activeAssignmentsQuery.session(session);
        const activeAssignments = await activeAssignmentsQuery;

        const assignmentTotals =
          activeAssignments.length > 0
            ? aggregateAssignmentTotalsMap(activeAssignments)
            : aggregatePlantTotalsMap(batch.rooms);

        await RoomAssignment.updateMany(
          { tenantId: req.tenantId, batchId: normalizedBatchId, active: true },
          { $set: { active: false, endedAt: now } },
          session ? { session } : undefined,
        );

        const assignment = new RoomAssignment({
          tenantId: req.tenantId,
          batchId: normalizedBatchId,
          roomId,
          assignedPlants: mapTotalsToPlants(assignmentTotals),
          source: source || "manual",
          notes: notes || null,
          active: true,
          startedAt: now,
          endedAt: null,
        });

        const savedAssignment = await assignment.save(
          session ? { session } : undefined,
        );

        return {
          status: 201,
          assignmentId: savedAssignment._id,
        };
      },
    );

    if (result?.body) {
      if (result.status === 200) {
        await recordAudit(req, {
          action: "update",
          resourceType: "room",
          resourceId: result.body.roomId,
          summary: "Unassigned all batches from room",
        });
      }
      return res.status(result.status).json(result.body);
    }

    const populatedAssignment = await RoomAssignment.findOne({
      tenantId: req.tenantId,
      _id: result.assignmentId,
    }).populate(ROOM_ASSIGNMENT_POPULATE);

    const batchLabel =
      populatedAssignment?.batchId?.batchNumber || populatedAssignment?.batchId;
    const roomLabel = populatedAssignment?.roomId?.name || roomId;

    await recordAudit(req, {
      action: "create",
      resourceType: "roomAssignment",
      resourceId: populatedAssignment._id,
      batchId: populatedAssignment.batchId?._id || populatedAssignment.batchId,
      summary: `Assigned batch ${batchLabel} to room ${roomLabel}`,
    });

    return res.status(201).json(populatedAssignment);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error:
          "An active assignment for this batch/room already exists. Refresh and try again.",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { active, endedAt, notes } = req.body;

    const assignment = await RoomAssignment.findOne({
      tenantId: req.tenantId,
      _id: req.params.id,
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    if (active !== undefined) assignment.active = active;
    if (endedAt !== undefined) assignment.endedAt = endedAt;
    if (notes !== undefined) assignment.notes = notes;

    if (active === false && endedAt === undefined) {
      assignment.endedAt = new Date();
    }

    const updatedAssignment = await assignment.save();
    const populatedAssignment = await updatedAssignment.populate(
      ROOM_ASSIGNMENT_POPULATE,
    );

    await recordAudit(req, {
      action: "update",
      resourceType: "roomAssignment",
      resourceId: updatedAssignment._id,
      batchId: updatedAssignment.batchId,
      summary: active === false
        ? "Ended room assignment"
        : "Updated room assignment",
    });

    res.json(populatedAssignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
