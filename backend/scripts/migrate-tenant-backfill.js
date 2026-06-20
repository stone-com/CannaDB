/**
 * One-time migration: create a default tenant and backfill tenantId on all
 * existing business records. Also syncs indexes to tenant-scoped compounds.
 *
 * Usage:
 *   node scripts/migrate-tenant-backfill.js
 *   npm run migrate:tenant
 *
 * Env (optional):
 *   MONGODB_URI          — same as server.js
 *   DEFAULT_TENANT_NAME  — default: "Default Tenant"
 *   DEFAULT_TENANT_SLUG  — default: "default"
 */

require("dotenv").config();

const mongoose = require("mongoose");

const Tenant = require("../models/Tenant");
const Company = require("../models/Company");
const Location = require("../models/Location");
const Room = require("../models/Room");
const Strain = require("../models/Strain");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const RoomAssignment = require("../models/RoomAssignment");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

const DEFAULT_TENANT_NAME =
  process.env.DEFAULT_TENANT_NAME || "Default Tenant";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "default";

const BACKFILL_MODELS = [
  { name: "Company", model: Company },
  { name: "Location", model: Location },
  { name: "Room", model: Room },
  { name: "Strain", model: Strain },
  { name: "Batch", model: Batch },
  { name: "Harvest", model: Harvest },
  { name: "RoomAssignment", model: RoomAssignment },
];

const MISSING_TENANT_FILTER = {
  $or: [{ tenantId: { $exists: false } }, { tenantId: null }],
};

async function findOrCreateDefaultTenant() {
  let tenant = await Tenant.findOne({ slug: DEFAULT_TENANT_SLUG });

  if (tenant) {
    console.log(
      `Using existing tenant "${tenant.name}" (${tenant._id}) [slug: ${tenant.slug}]`,
    );
    return tenant;
  }

  tenant = await Tenant.create({
    name: DEFAULT_TENANT_NAME,
    slug: DEFAULT_TENANT_SLUG,
    status: "active",
  });

  console.log(
    `Created default tenant "${tenant.name}" (${tenant._id}) [slug: ${tenant.slug}]`,
  );
  return tenant;
}

async function backfillModel({ name, model }, tenantId) {
  const pending = await model.countDocuments(MISSING_TENANT_FILTER);

  if (pending === 0) {
    console.log(`  ${name}: nothing to backfill`);
    return { name, updated: 0, pending: 0 };
  }

  const result = await model.updateMany(MISSING_TENANT_FILTER, {
    $set: { tenantId },
  });

  console.log(`  ${name}: backfilled ${result.modifiedCount} of ${pending}`);
  return { name, updated: result.modifiedCount, pending };
}

async function syncModelIndexes({ name, model }) {
  await model.syncIndexes();
  console.log(`  ${name}: indexes synced`);
}

async function verifyBackfill() {
  const remaining = [];

  for (const { name, model } of BACKFILL_MODELS) {
    const count = await model.countDocuments(MISSING_TENANT_FILTER);
    if (count > 0) {
      remaining.push({ name, count });
    }
  }

  return remaining;
}

async function main() {
  console.log("Tenant backfill migration");
  console.log(`Database: ${MONGODB_URI}`);
  console.log("");

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const tenant = await findOrCreateDefaultTenant();
  const tenantId = tenant._id;

  console.log("\nBackfilling tenantId...");
  const results = [];
  for (const entry of BACKFILL_MODELS) {
    results.push(await backfillModel(entry, tenantId));
  }

  console.log("\nSyncing tenant-scoped indexes...");
  for (const entry of BACKFILL_MODELS) {
    await syncModelIndexes(entry);
  }

  const remaining = await verifyBackfill();
  if (remaining.length > 0) {
    console.error("\nMigration incomplete. Records still missing tenantId:");
    for (const { name, count } of remaining) {
      console.error(`  ${name}: ${count}`);
    }
    process.exitCode = 1;
    return;
  }

  const totalUpdated = results.reduce((sum, row) => sum + row.updated, 0);
  console.log("\nMigration complete.");
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Records updated: ${totalUpdated}`);
  console.log(
    "\nSave this tenant ID — routes and auth will need it until login is wired up.",
  );
}

main()
  .catch((error) => {
    console.error("\nMigration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
