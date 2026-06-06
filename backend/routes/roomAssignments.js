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

// Shared populate config so assignment responses include room details,
// batch summary info, and readable strain data.
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

router.get("/", async (req, res) => {
  try {
    // By default, only return active assignments unless the client asks for all.
    const activeOnly = req.query.active !== "false";
    const filter = activeOnly ? { active: true } : {};

    // Newest assignments first makes current activity easier to read in the UI.
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
        // First confirm the destination room exists.
        const roomQuery = Room.findById(roomId);
        if (session) roomQuery.session(session);
        const room = await roomQuery;

        if (!room) {
          return { status: 404, body: { error: "Room not found" } };
        }

        // No batchId means unassign this room.
        if (!normalizedBatchId) {
          const now = new Date();

          // End every active assignment currently attached to this room.
          const unassignResult = await RoomAssignment.updateMany(
            { roomId, active: true },
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

        // Otherwise, load the batch we want to place into the room.
        const batchQuery = Batch.findById(normalizedBatchId);
        if (session) batchQuery.session(session);
        const batch = await batchQuery;

        if (!batch) {
          return { status: 404, body: { error: "Batch not found" } };
        }

        // A batch can only be assigned into rooms at its own location.
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

        // Look at current active assignments first.
        // If the batch is already split across rooms, those assignments are the
        // live source of truth for plant counts.
        const activeAssignmentsQuery = RoomAssignment.find({
          batchId: normalizedBatchId,
          active: true,
        }).select("assignedPlants");
        if (session) activeAssignmentsQuery.session(session);
        const activeAssignments = await activeAssignmentsQuery;

        const assignmentTotals =
          activeAssignments.length > 0
            ? aggregateAssignmentTotalsMap(activeAssignments)
            : aggregatePlantTotalsMap(batch.rooms);

        // Keep one active assignment per batch.
        await RoomAssignment.updateMany(
          { batchId: normalizedBatchId, active: true },
          { $set: { active: false, endedAt: now } },
          session ? { session } : undefined,
        );

        // Create the new active assignment for this room.
        const assignment = new RoomAssignment({
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
      return res.status(result.status).json(result.body);
    }

    const populatedAssignment = await RoomAssignment.findById(
      result.assignmentId,
    ).populate(ROOM_ASSIGNMENT_POPULATE);

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

    // Load the assignment first so we can patch only the fields that were sent.
    const assignment = await RoomAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    if (active !== undefined) assignment.active = active;
    if (endedAt !== undefined) assignment.endedAt = endedAt;
    if (notes !== undefined) assignment.notes = notes;

    // If the client turns an assignment off without an end time,
    // close it using the current time.
    if (active === false && endedAt === undefined) {
      assignment.endedAt = new Date();
    }

    const updatedAssignment = await assignment.save();
    const populatedAssignment = await updatedAssignment.populate(
      ROOM_ASSIGNMENT_POPULATE,
    );

    res.json(populatedAssignment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
