# Inventory Management App: Beginner Overview

This document explains what each major file does, how the frontend and backend talk to each other, what props are passed into components, and what each API route expects/returns.

## 1) Big Picture

This app has two parts:

- backend: Express + MongoDB API server
- frontend: React + Vite web app

How they work together:

1. You open the React app in the browser.
2. React calls endpoints like `/api/strains`.
3. Vite proxy forwards `/api/*` requests to backend on `http://localhost:5000`.
4. Backend reads/writes MongoDB and returns JSON.
5. React renders the returned data.

## 2) Project Structure (What Each File Does)

## Root

- `backend/`: API server code
- `frontend/`: React UI code
- `BEGINNER_APP_OVERVIEW.md`: this guide

## Backend files

- `backend/package.json`
  - Backend dependencies and scripts (`npm run dev`, `npm start`).

- `backend/server.js`
  - App entry point.
  - Sets middleware (`cors`, `express.json()`), connects to MongoDB, mounts routers, starts server.
  - Mounts routes:
    - `/api/strains`
    - `/api/batches`
    - `/api/companies`
    - `/api/locations`
    - `/api/rooms`
    - `/api/harvests`
  - Health endpoint: `GET /api/health` -> `{ status: "ok", message: "Server is running" }`

### Backend models (MongoDB schemas)

- `backend/models/Company.js`
  - Fields: `name` (required, unique), `createdAt`

- `backend/models/Location.js`
  - Fields: `companyId` (ref Company, required), `nickname` (required), `address`, `createdAt`

- `backend/models/Room.js`
  - Fields: `locationId` (ref Location, required), `name` (required), `type` (enum required), `sqFoot`, `batchId` (ref Batch), `createdAt`

- `backend/models/Strain.js`
  - Fields: `name` (required, unique), `type` (enum), `status` (enum), `avgWeightPerPlant`, `createdAt`

- `backend/models/Batch.js`
  - Fields: `batchNumber` (required, unique), `harvestId` (ref Harvest), `cloneDate` (required), `harvestDate`, `plants[]`
  - `plants[]` items: `{ strainId (ref Strain), count }`

- `backend/models/Harvest.js`
  - Main harvest record with nested room and strain metrics.
  - Important required fields: `harvestNumber` (required, unique), `batchId` (required), `locationId` (required), `rooms[]`
  - Derived totals are auto-calculated in pre-validation hook.
  - Calls utility: `applyHarvestCalculations`.

- `backend/models/DryRoomData.js`
  - Additional dry room metrics model (not currently used by routes in this code).

### Backend routes

- `backend/routes/strains.js`
  - `POST /api/strains`
    - Required body: `name`
    - Optional: `type`, `status`
    - Returns: created strain object
    - Errors: 400 if missing name or duplicate name
  - `GET /api/strains`
    - Returns: array of strains
  - `GET /api/strains/:id`
    - Returns: one strain or 404

- `backend/routes/companies.js`
  - `POST /api/companies`
    - Required body: `name`
    - Returns: created company
    - Errors: 400 if missing/duplicate name
  - `GET /api/companies`
    - Returns: array of companies
  - `GET /api/companies/:id`
    - Returns: one company or 404

- `backend/routes/locations.js`
  - `POST /api/locations`
    - Required body: `companyId`, `nickname`
    - Optional: `address`
    - Returns: created location (with populated company)
  - `GET /api/locations`
    - Returns: array of locations (with populated company)
  - `GET /api/locations/:id`
    - Returns: one location or 404

- `backend/routes/rooms.js`
  - `POST /api/rooms`
    - Required body: `locationId`, `name`, `type`
    - Optional: `sqFoot`, `batchId`
    - Returns: created room (populated location + batch + strain refs)
  - `GET /api/rooms`
    - Returns: array of rooms (populated)
  - `GET /api/rooms/:id`
    - Returns: one room or 404
  - `PATCH /api/rooms/:id`
    - Updatable body fields: `name`, `type`, `sqFoot`, `batchId`
    - Returns: updated room (populated)

- `backend/routes/batches.js`
  - `POST /api/batches`
    - Required body: `batchNumber`, `cloneDate`
    - Optional: `harvestId`, `harvestDate`, `plants[]`
    - Returns: created batch (populated `harvestId`, `plants.strainId`)
    - Errors: 400 on duplicate batchNumber
  - `GET /api/batches`
    - Returns: array of batches (populated)
  - `GET /api/batches/:id`
    - Returns: one batch or 404

- `backend/routes/harvests.js`
  - `POST /api/harvests`
    - Required body: `batchId`
    - Also typically needed by model validation: `locationId` and valid `harvestNumber` in many real cases
    - Optional: `rooms[]`, `harvestDate`
    - Returns: created harvest (populated)
  - `GET /api/harvests`
    - Returns: array of harvests (populated)
  - `GET /api/harvests/:id`
    - Returns: one harvest or 404
  - `PATCH /api/harvests/:id`
    - Updatable body fields: `locationId`, `harvestNumber`, `rooms`, `harvestDate`
    - Returns: updated harvest (populated)

### Backend utilities/scripts

- `backend/utils/harvestCalculations.js`
  - Recomputes derived harvest values such as:
    - total wet/dry weights
    - average per plant
    - percent wet->dry change
    - grams per square foot yield

- `backend/scripts/seed-room-batches.js`
  - Seed helper script to create demo batches and assign active batches to rooms.

## Frontend files

- `frontend/package.json`
  - Frontend scripts: `npm run dev`, `npm run build`, `npm run lint`.

- `frontend/index.html`
  - Base HTML page with root mount element: `<div id="root"></div>`.

- `frontend/vite.config.js`
  - Dev server proxy: `/api` forwards to `http://localhost:5000`.

- `frontend/eslint.config.js`
  - Lint rules.

- `frontend/src/main.jsx`
  - React entry point: renders `<App />` into `#root`.

- `frontend/src/index.css`
  - Global starter styles.

- `frontend/src/App.css`
  - Main app styling: sidebar, taskbar, floating windows, forms, tables.

- `frontend/src/App.jsx`
  - Main page component controlling:
    - data fetching (`strains`, `rooms`, `harvests`)
    - page switching (`dashboard` vs `admin`)
    - which windows are open/minimized
    - taskbar tabs state
  - Renders `AdminPanel`, `DraggableWindow`, `StrainDataViewer`, `HarvestReportPage`, `Taskbar`.

### Frontend components

- `frontend/src/components/AdminPanel.jsx`
  - Accordion UI for admin forms.
  - Contains inline Strain form and embeds other form components.

- `frontend/src/components/CompanyForm.jsx`
  - Creates company via `POST /api/companies`.
  - Emits browser event: `company:created`.

- `frontend/src/components/LocationForm.jsx`
  - Loads companies from `/api/companies`.
  - Creates location via `POST /api/locations`.
  - Emits `location:created` and listens for `company:created`.

- `frontend/src/components/RoomForm.jsx`
  - Two modes via prop `section`:
    - add mode: create room via `POST /api/rooms`
    - assign mode: assign/unassign batch via `PATCH /api/rooms/:id`
  - Loads locations, rooms, batches.
  - Emits `room:created` when room is created/updated.

- `frontend/src/components/HarvestForm.jsx`
  - Creates harvest via `POST /api/harvests`.
  - Loads batches and rooms.
  - Emits `harvest:created`.

- `frontend/src/components/HarvestReportPage.jsx`
  - Receives `harvests` prop.
  - Lets user select harvest, shows summary cards + per-room/per-strain metrics table.

- `frontend/src/components/StrainDataViewer.jsx`
  - Receives `strains` and `rooms` props.
  - Aggregates plant counts by strain from room-assigned batches.
  - Expandable row details for room-level breakdown.

- `frontend/src/components/DraggableWindow.jsx`
  - Generic floating window shell:
    - drag, resize, bring-to-front
    - minimize/close controls
    - renders `children` content

- `frontend/src/components/Taskbar.jsx`
  - Bottom navigation and minimized/open window tabs.

- `frontend/src/assets/`
  - Static assets folder (images/icons), currently not central to app logic.

## 3) Component Prop Flow (Who Passes What)

Main parent-child flow is in `App.jsx`.

- `App` -> `AdminPanel`
  - Props: none

- `App` -> `DraggableWindow` (Strains window)
  - `title`
  - `onClose`
  - `isMinimized`
  - `onMinimize`
  - `defaultX`, `defaultY`, `defaultW`, `defaultH`
  - `children`: `<StrainDataViewer strains={strains} rooms={rooms} />`

- `App` -> `DraggableWindow` (Harvest Report window)
  - Same window props
  - `children`: `<HarvestReportPage harvests={harvests} />`

- `App` -> `Taskbar`
  - `activePage`
  - `onNavigate`
  - `tabs` array where each tab contains:
    - `key`, `label`, `visible`, `minimized`, `onClick`

- `AdminPanel` -> `CompanyForm`
  - `embedded` (true)

- `AdminPanel` -> `LocationForm`
  - `embedded` (true)

- `AdminPanel` -> `RoomForm`
  - First use: `embedded` + `section="add"`
  - Second use: `embedded` + `section="assign"`

- `AdminPanel` -> `HarvestForm`
  - `embedded` (true)

## 4) Event-Driven Refresh Pattern (Important)

The app uses browser custom events to refresh data after forms submit.

Example flow:

1. `CompanyForm` successfully posts a company.
2. It dispatches `company:created`.
3. `LocationForm` listens for `company:created` and refetches companies.
4. `App` also listens for creation events and calls `fetchAllData()` for dashboard data.

Events used in code:

- `company:created`
- `location:created`
- `room:created`
- `harvest:created`
- `strain:created`
- `batch:created` (listeners exist in some forms)

## 5) Data Relationships (MongoDB)

High-level relations:

- Company 1 -> many Locations
- Location 1 -> many Rooms
- Room optionally -> one current Batch (`batchId`)
- Batch -> many strain plant entries (`plants[]`)
- Harvest -> one Batch + one Location + many Rooms + many Strain metric entries

Many routes use `populate(...)`, so API responses often include full related objects, not just raw IDs.

## 6) API Request/Response Cheat Sheet

Common response style:

- Success: JSON document or array
- Client errors: `400` with `{ error: "..." }`
- Not found: `404` with `{ error: "..." }`
- Server errors: `500` with `{ error: error.message }`

### Minimal example payloads

Create company:

```json
POST /api/companies
{
  "name": "Stone Farms"
}
```

Create location:

```json
POST /api/locations
{
  "companyId": "<companyObjectId>",
  "nickname": "Main Facility",
  "address": "123 Grow Way"
}
```

Create room:

```json
POST /api/rooms
{
  "locationId": "<locationObjectId>",
  "name": "Flower Room A",
  "type": "Flower",
  "sqFoot": 1200
}
```

Assign batch to room:

```json
PATCH /api/rooms/<roomId>
{
  "batchId": "<batchObjectId>"
}
```

Create strain:

```json
POST /api/strains
{
  "name": "Blue Dream",
  "type": "hybrid",
  "status": "production"
}
```

Create batch:

```json
POST /api/batches
{
  "batchNumber": "BATCH-1001",
  "cloneDate": "2026-03-01",
  "harvestDate": "2026-05-24",
  "plants": [
    { "strainId": "<strainId>", "count": 80 },
    { "strainId": "<strainId>", "count": 60 }
  ]
}
```

Create harvest:

```json
POST /api/harvests
{
  "batchId": "<batchId>",
  "locationId": "<locationId>",
  "harvestNumber": "HARV-2026-001",
  "rooms": [
    {
      "roomId": "<roomId>",
      "strains": [
        {
          "strainId": "<strainId>",
          "plantCount": 50,
          "totes": [{ "wetWeight": 1200 }],
          "totalDryWeightGrams": 250
        }
      ]
    }
  ],
  "harvestDate": "2026-04-01"
}
```

## 7) End-to-End User Flow (Simple)

1. Admin opens Admin page.
2. Adds Company -> adds Location -> adds Room -> creates Batch (if your UI includes it) -> assigns Batch to Room -> adds Harvest.
3. Events fire and data refreshes.
4. On Dashboard page:
   - Strains window shows live plant totals by strain based on room-assigned batches.
   - Harvest Report window shows harvest summary and detailed room/strain metrics.

## 8) Current Gotcha to Be Aware Of

In `frontend/src/App.jsx`, there is a `<New />` component rendered at the bottom, but no `New` import/definition was found in the frontend source.

That likely causes a runtime/render error unless this component exists elsewhere and was omitted.

## 9) If You Are Brand New to Coding

When reading this codebase, focus on this order:

1. `backend/server.js` (how API is wired)
2. One route file (for example `routes/rooms.js`)
3. Matching model file (`models/Room.js`)
4. `frontend/src/App.jsx` (main UI orchestrator)
5. One form component (for example `RoomForm.jsx`)
6. One viewer component (`StrainDataViewer.jsx`)

That path will show you the full loop:

- user action -> frontend request -> backend route -> database -> response -> UI refresh
