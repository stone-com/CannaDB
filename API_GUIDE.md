# Inventory Management API Guide

This guide documents the current backend API in the project.

Base URL during local development:

```text
http://localhost:5000/api
```

All request bodies are JSON.

## Common Response Patterns

- `200 OK`: request succeeded
- `201 Created`: new record created
- `400 Bad Request`: missing or invalid input
- `404 Not Found`: requested record does not exist
- `409 Conflict`: duplicate or conflicting state
- `500 Internal Server Error`: unexpected server error

Most error responses look like this:

```json
{
  "error": "Human readable error message"
}
```

## Important Data Rules

- Active room placement is tracked by `RoomAssignment` records.
- `Batch.rooms` is still stored, but active assignment data is treated as the live source of truth.
- A batch can only have one harvest record.
- Room names must be unique inside a location.
- Location nicknames must be unique inside a company.

## Useful Enums

### Strain `type`

- `indica`
- `sativa`
- `hybrid`
- `CBD`

### Strain `status`

- `production`
- `bench`
- `pheno`

### Room `type`

- `Flower`
- `Veg`
- `Mom`
- `Clone`
- `Culture`
- `Inventory`
- `Packaging`
- `Storage`
- `Drying`

### Batch `batchType`

- `production`
- `mom`

### Batch `lifecycleStage`

- `Clone`
- `Veg`
- `Flower`
- `Mom`
- `HarvestReady`
- `Drying`
- `Completed`

### RoomAssignment `source`

- `manual`
- `timer`

## Health

### `GET /health`

Checks whether the API is running and reports MongoDB connection state.

Returns:

```json
{
  "status": "ok",
  "message": "Server is running",
  "database": {
    "state": "connected",
    "readyState": 1
  }
}
```

If Mongo is not connected, this route returns `503` with `status: "degraded"`.

## Companies

### `POST /companies`

Creates a company.

Payload:

```json
{
  "name": "Acme Grow Co"
}
```

Required fields:

- `name`

Returns:

- created company document
- `400` if `name` is missing
- `400` if company name already exists

### `GET /companies`

Returns all companies.

### `GET /companies/:id`

Returns one company by ID.

Returns:

- company document
- `404` if not found

## Strains

### `POST /strains`

Creates a strain.

Payload:

```json
{
  "name": "Blue Dream",
  "type": "hybrid",
  "status": "production"
}
```

Required fields:

- `name`

Optional fields:

- `type`
- `status`

Returns:

- created strain document
- `400` if `name` is missing
- `400` if strain name already exists

### `GET /strains`

Returns all strains.

### `GET /strains/:id`

Returns one strain by ID.

Returns:

- strain document
- `404` if not found

## Locations

### `POST /locations`

Creates a location for a company.

Payload:

```json
{
  "companyId": "665000000000000000000001",
  "nickname": "Denver Facility",
  "address": "123 Main St"
}
```

Required fields:

- `companyId`
- `nickname`

Optional fields:

- `address`

Returns:

- created location with populated `companyId`
- `400` if required fields are missing
- `409` if nickname already exists for that company

### `GET /locations`

Returns all locations with populated company details.

### `GET /locations/:id`

Returns one location with populated company details.

Returns:

- location document
- `404` if not found

## Rooms

### `POST /rooms`

Creates a room inside a location.

Payload:

```json
{
  "locationId": "665000000000000000000002",
  "name": "Flower Room A",
  "type": "Flower",
  "sqFoot": 850
}
```

Required fields:

- `locationId`
- `name`
- `type`

Optional fields:

- `sqFoot`

Returns:

- created room with populated `locationId`
- `400` if required fields are missing
- `409` if room name already exists at that location

### `GET /rooms`

Returns all rooms with populated location details.

### `GET /rooms/:id`

Returns one room with populated location details.

Returns:

- room document
- `404` if not found

### `PATCH /rooms/:id`

Updates one or more room fields.

Payload:

```json
{
  "name": "Flower Room B",
  "type": "Flower",
  "sqFoot": 900
}
```

All fields are optional.

Returns:

- updated room with populated location details
- `404` if not found

## Batches

### `POST /batches`

Creates a batch.

Payload:

```json
{
  "batchNumber": "B-240501",
  "cloneDate": "2026-05-01T00:00:00.000Z",
  "harvestDate": "2026-08-01T00:00:00.000Z",
  "location": "665000000000000000000002",
  "batchType": "production",
  "rooms": [
    {
      "roomId": "665000000000000000000010",
      "plants": [
        {
          "strainId": "665000000000000000000020",
          "count": 100
        }
      ]
    }
  ]
}
```

Required fields:

- `batchNumber`
- `cloneDate`

Optional fields:

- `harvestDate`
- `location`
- `batchType`
- `rooms`

Behavior:

- new batches start with `lifecycleStage: "Clone"`
- `stageStartedAt` is set from `cloneDate`

Returns:

- created batch with populated strain refs inside `rooms.plants`
- `400` if `batchNumber` or `cloneDate` is missing
- `400` if batch number already exists

### `GET /batches`

Returns all batches.

Behavior:

- returns populated strain refs inside `rooms.plants`
- if active room assignments exist, the response swaps in live room data derived from those assignments

### `GET /batches/:id`

Returns one batch by ID.

Behavior:

- includes live room state derived from active assignments when available

Returns:

- batch document
- `404` if not found

### `POST /batches/:id/move`

Moves a batch into one room and advances it to the next lifecycle stage.

Payload:

```json
{
  "roomId": "665000000000000000000010",
  "notes": "Moved into flower"
}
```

Required fields:

- `roomId`

Behavior:

- closes existing active room assignments for the batch
- creates one new active room assignment
- advances lifecycle stage based on `batchType`

Production stage map:

- `Clone -> Veg`
- `Veg -> Flower`
- `Flower -> HarvestReady`

Mom stage map:

- `Clone -> Veg`
- `Veg -> Mom`

Returns:

- object with `batch` and `assignment`
- `400` if `roomId` missing
- `400` if no next stage exists
- `404` if batch or room not found

### `POST /batches/:id/assign-rooms`

Assigns a batch to one room or splits it across multiple rooms.

Whole-room payload:

```json
{
  "mode": "whole",
  "roomId": "665000000000000000000010",
  "notes": "Whole batch moved",
  "advanceStage": true
}
```

Split payload:

```json
{
  "mode": "split",
  "assignments": [
    {
      "roomId": "665000000000000000000010",
      "plants": [
        {
          "strainId": "665000000000000000000020",
          "count": 60
        }
      ]
    },
    {
      "roomId": "665000000000000000000011",
      "plants": [
        {
          "strainId": "665000000000000000000020",
          "count": 40
        }
      ]
    }
  ],
  "notes": "Split across rooms",
  "advanceStage": false
}
```

Behavior:

- whole mode puts the full live batch plant total into one room
- split mode must account for every current plant exactly
- all selected rooms must belong to the batch location
- closes existing active assignments and creates new ones
- can optionally advance lifecycle stage

Returns:

- object with `batch` and `assignments`
- `400` for missing rooms, bad split totals, or invalid next stage
- `404` if batch not found
- `409` if there is an assignment conflict

### `POST /batches/:id/create-moms`

Cuts plants from a production batch and creates a new mom batch.

Payload:

```json
{
  "momRoomId": "665000000000000000000012",
  "notes": "Selected keeper cuts",
  "plants": [
    {
      "strainId": "665000000000000000000020",
      "count": 8
    }
  ]
}
```

Required fields:

- `plants` array with at least one positive `count`

Optional fields:

- `momRoomId`
- `notes`

Behavior:

- only works on `production` batches
- checks current available plant totals
- if `momRoomId` is missing, tries to find a `Mom` room at the same location
- reduces plants from the source batch's live room layout
- creates a new batch with `batchType: "mom"`
- creates a new active room assignment for the mom batch

Returns:

- object with `sourceBatch`, `momBatch`, and `momAssignment`
- `400` if payload invalid, source is not a production batch, or no mom room exists
- `404` if source batch or selected mom room not found
- `409` if a conflicting assignment or batch number is detected

## Room Assignments

### `GET /room-assignments`

Returns room assignments.

Query params:

- `active=true` or omit param: return only active assignments
- `active=false`: return all assignments

Behavior:

- sorted newest first
- includes room details, batch summary fields, and populated strain refs for `assignedPlants`

### `POST /room-assignments`

Creates a room assignment or unassigns a room.

Assign payload:

```json
{
  "batchId": "665000000000000000000030",
  "roomId": "665000000000000000000010",
  "source": "manual",
  "notes": "Manual assignment"
}
```

Unassign payload:

```json
{
  "roomId": "665000000000000000000010",
  "source": "manual",
  "notes": "Room cleared"
}
```

Required fields:

- `roomId`

Optional fields:

- `batchId`
- `source`
- `notes`

Behavior when `batchId` is present:

- validates room and batch exist
- room must belong to batch location
- if batch already has active assignments, their plant totals are treated as the live source of truth
- closes existing active assignments for the batch
- creates one new active assignment

Behavior when `batchId` is missing or empty:

- ends every active assignment currently tied to the room

Returns:

- created assignment document when assigning
- summary object when unassigning
- `400` if `roomId` missing or room location mismatches batch location
- `404` if room or batch not found
- `409` if active assignment conflict exists

### `PATCH /room-assignments/:id`

Updates an assignment.

Payload:

```json
{
  "active": false,
  "endedAt": "2026-05-30T12:00:00.000Z",
  "notes": "Closed manually"
}
```

All fields are optional.

Behavior:

- updates only the fields sent
- if `active` is set to `false` and no `endedAt` is provided, the API fills in the current time

Returns:

- updated assignment with populated refs
- `404` if assignment not found

## Harvests

### `POST /harvests`

Creates a harvest record for a batch.

Payload:

```json
{
  "batchId": "665000000000000000000030",
  "locationId": "665000000000000000000002",
  "harvestNumber": "H-240801-01",
  "harvestDate": "2026-08-01T00:00:00.000Z",
  "rooms": [
    {
      "roomId": "665000000000000000000010",
      "strains": [
        {
          "strainId": "665000000000000000000020",
          "plantCount": 100,
          "totes": [{ "wetWeight": 2500 }, { "wetWeight": 2550 }],
          "totalDryWeightGrams": 1400
        }
      ]
    }
  ]
}
```

Required fields:

- `batchId`

Optional fields:

- `locationId`
- `harvestNumber`
- `harvestDate`
- `rooms`

Behavior:

- validates the batch exists
- enforces one harvest per batch
- validates selected rooms and location consistency
- saves harvest metrics and derived totals through the Harvest model
- moves the batch to `Drying`
- closes any active room assignments for the batch

Returns:

- created harvest with populated room, strain, batch, and location refs
- `400` for invalid rooms, location mismatches, or duplicate harvest number
- `404` if batch not found
- `409` if batch already has a harvest record

### `GET /harvests`

Returns all harvests with populated refs.

### `GET /harvests/:id`

Returns one harvest with populated refs.

Returns:

- harvest document
- `404` if not found

### `PATCH /harvests/:id`

Updates harvest fields.

Payload:

```json
{
  "locationId": "665000000000000000000002",
  "harvestNumber": "H-240801-01",
  "harvestDate": "2026-08-01T00:00:00.000Z",
  "rooms": [
    {
      "roomId": "665000000000000000000010",
      "strains": [
        {
          "strainId": "665000000000000000000020",
          "plantCount": 100,
          "totes": [{ "wetWeight": 2500 }],
          "totalDryWeightGrams": 1400
        }
      ]
    }
  ],
  "finalizeDryWeights": true
}
```

All fields are optional.

Behavior:

- updates only the fields sent
- recalculates derived harvest totals on save
- if `finalizeDryWeights` is `true`, the related batch is moved to `Completed`

Returns:

- updated harvest with populated refs
- `404` if harvest not found
- `400` for duplicate harvest number

## Notes For Frontend Use

- `GET /batches` and `GET /batches/:id` may return `rooms` based on active `RoomAssignment` records, not only the originally stored batch room array.
- `RoomAssignment.assignedPlants` is the live room placement data to trust for active room state.
- Harvest totals such as wet weight, dry weight, percent change, and yield are calculated automatically when the harvest is saved.
