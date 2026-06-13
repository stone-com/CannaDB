/**
 * Reseed batches, harvests, and room assignments for the default tenant.
 * Keeps existing companies, locations, rooms, and strains.
 *
 * Usage:
 *   npm run seed:default-batches
 */

require("dotenv").config();

const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const Location = require("../models/Location");
const Room = require("../models/Room");
const Strain = require("../models/Strain");
const Batch = require("../models/Batch");
const Harvest = require("../models/Harvest");
const RoomAssignment = require("../models/RoomAssignment");
const {
  clearOperationalData,
  seedLocationGrowData,
} = require("./lib/growSeedHelpers");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "default";

const LOCATION_SEED_CONFIG = [
  { nicknameMatch: /moose/i, batchPrefix: "ML", harvestPrefix: "H-ML" },
  { nicknameMatch: /iron/i, batchPrefix: "IG", harvestPrefix: "H-IG" },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const tenant = await Tenant.findOne({ slug: DEFAULT_TENANT_SLUG });
  if (!tenant) {
    throw new Error(
      `Default tenant "${DEFAULT_TENANT_SLUG}" not found. Run migrate:tenant first.`,
    );
  }

  const [locations, strains] = await Promise.all([
    Location.find({ tenantId: tenant._id }).lean(),
    Strain.find({ tenantId: tenant._id }).lean(),
  ]);

  if (!strains.length) {
    throw new Error("No strains found for default tenant — add strains first.");
  }

  console.log(`Tenant: ${tenant.name}`);
  console.log(`Locations: ${locations.length}, Strains: ${strains.length}`);
  console.log("Clearing batches, harvests, and assignments...\n");

  await clearOperationalData(tenant._id);

  let totals = { batches: 0, harvests: 0, assignments: 0 };

  for (const config of LOCATION_SEED_CONFIG) {
    const location = locations.find((entry) =>
      config.nicknameMatch.test(entry.nickname),
    );
    if (!location) {
      console.log(`  Skipping — no location matching ${config.nicknameMatch}`);
      continue;
    }

    const rooms = await Room.find({
      tenantId: tenant._id,
      locationId: location._id,
    }).lean();

    console.log(`Seeding ${location.nickname} (${rooms.length} rooms)...`);

    const result = await seedLocationGrowData({
      tenantId: tenant._id,
      location,
      rooms,
      strains,
      batchPrefix: config.batchPrefix,
      harvestPrefix: config.harvestPrefix,
      historicalWeeks: 20,
      strainsPerBatchMin: 6,
      strainsPerBatchMax: 8,
      totalPlantsBase: 156,
      cloneBatchCount: 3,
      momBatchCount: 3,
    });

    totals.batches += result.batches;
    totals.harvests += result.harvests;
    totals.assignments += result.assignments;
    console.log(
      `  Created ${result.batches} batches, ${result.harvests} harvests, ${result.assignments} active assignments`,
    );
  }

  const summary = {
    batches: await Batch.countDocuments({ tenantId: tenant._id }),
    harvests: await Harvest.countDocuments({ tenantId: tenant._id }),
    assignments: await RoomAssignment.countDocuments({
      tenantId: tenant._id,
      active: true,
    }),
  };

  console.log("\nDefault tenant reseed complete:");
  console.log(`  Batches:            ${summary.batches}`);
  console.log(`  Harvests:           ${summary.harvests}`);
  console.log(`  Active assignments: ${summary.assignments}`);
  console.log("\nLogin: admin@demo.local / demo1234");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
