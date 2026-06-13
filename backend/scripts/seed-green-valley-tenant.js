/**
 * Ensure Green Valley tenant infrastructure exists, then reseed batches/harvests.
 *
 * Usage:
 *   npm run seed:green-valley
 *
 * Login:
 *   Email:    ops@greenvalley.local
 *   Password: green1234
 */

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Company = require("../models/Company");
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

const TENANT_SLUG = process.env.GREEN_VALLEY_TENANT_SLUG || "green-valley";
const TENANT_NAME = process.env.GREEN_VALLEY_TENANT_NAME || "Green Valley Cultivation";
const USER_EMAIL = process.env.GREEN_VALLEY_USER_EMAIL || "ops@greenvalley.local";
const USER_PASSWORD = process.env.GREEN_VALLEY_USER_PASSWORD || "green1234";
const USER_NAME = process.env.GREEN_VALLEY_USER_NAME || "Green Valley Ops";

const STRAIN_DEFS = [
  { name: "Purple Haze", type: "hybrid", status: "production", dryPerPlant: 55 },
  { name: "Blue Dream", type: "sativa", status: "production", dryPerPlant: 62 },
  { name: "OG Kush", type: "indica", status: "production", dryPerPlant: 48 },
  { name: "Lemon Skunk", type: "hybrid", status: "production", dryPerPlant: 58 },
  { name: "Northern Lights", type: "indica", status: "production", dryPerPlant: 52 },
  { name: "Wedding Cake", type: "hybrid", status: "bench", dryPerPlant: 60 },
  { name: "Gelato 41", type: "hybrid", status: "production", dryPerPlant: 57 },
  { name: "Sour Diesel", type: "sativa", status: "production", dryPerPlant: 54 },
  { name: "Granddaddy Purple", type: "indica", status: "production", dryPerPlant: 50 },
  { name: "Jack Herer", type: "sativa", status: "production", dryPerPlant: 59 },
  { name: "Dosidos", type: "indica", status: "production", dryPerPlant: 53 },
  { name: "Sunset Sherbet", type: "hybrid", status: "production", dryPerPlant: 56 },
  { name: "MAC 1", type: "hybrid", status: "production", dryPerPlant: 61 },
  { name: "Ice Cream Cake", type: "indica", status: "production", dryPerPlant: 55 },
  { name: "Mimosa", type: "sativa", status: "production", dryPerPlant: 58 },
  { name: "Forbidden Fruit", type: "indica", status: "production", dryPerPlant: 51 },
  { name: "Rainbow Belts", type: "hybrid", status: "pheno", dryPerPlant: 57 },
  { name: "Papaya Punch", type: "hybrid", status: "production", dryPerPlant: 54 },
];

const ROOM_DEFS = [
  { name: "Mom Room", type: "Mom", sqFoot: 960 },
  { name: "Clone Bay", type: "Clone", sqFoot: 720 },
  { name: "Veg Room 1", type: "Veg", sqFoot: 1440 },
  { name: "Flower Room A", type: "Flower", sqFoot: 1920 },
  { name: "Dry Room", type: "Drying", sqFoot: 480 },
];

async function ensureInfrastructure(tenant) {
  const passwordHash = await bcrypt.hash(USER_PASSWORD, 10);
  const normalizedEmail = USER_EMAIL.trim().toLowerCase();

  let user = await User.findOne({ tenantId: tenant._id, email: normalizedEmail });
  if (user) {
    user.passwordHash = passwordHash;
    user.name = USER_NAME;
    user.role = "owner";
    await user.save();
  } else {
    await User.create({
      tenantId: tenant._id,
      email: normalizedEmail,
      passwordHash,
      name: USER_NAME,
      role: "owner",
    });
  }

  let company = await Company.findOne({
    tenantId: tenant._id,
    name: "Green Valley Cultivation LLC",
  });

  if (!company) {
    company = await Company.create({
      tenantId: tenant._id,
      name: "Green Valley Cultivation LLC",
    });
  }

  let location = await Location.findOne({
    tenantId: tenant._id,
    companyId: company._id,
    nickname: "Riverbend Campus",
  });

  if (!location) {
    location = await Location.create({
      tenantId: tenant._id,
      companyId: company._id,
      nickname: "Riverbend Campus",
      address: "1842 Willow Creek Rd, Humboldt County, CA",
    });
  }

  for (const def of ROOM_DEFS) {
    const exists = await Room.findOne({
      tenantId: tenant._id,
      locationId: location._id,
      name: def.name,
    });
    if (!exists) {
      await Room.create({
        tenantId: tenant._id,
        locationId: location._id,
        name: def.name,
        type: def.type,
        sqFoot: def.sqFoot,
      });
    }
  }

  for (const def of STRAIN_DEFS) {
    const exists = await Strain.findOne({ tenantId: tenant._id, name: def.name });
    if (!exists) {
      await Strain.create({
        tenantId: tenant._id,
        name: def.name,
        type: def.type,
        status: def.status,
        avgWeightPerPlant: def.dryPerPlant,
      });
    }
  }

  return { normalizedEmail, company, location };
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  let tenant = await Tenant.findOne({ slug: TENANT_SLUG });
  if (!tenant) {
    tenant = await Tenant.create({
      name: TENANT_NAME,
      slug: TENANT_SLUG,
      status: "active",
    });
    console.log(`Created tenant: ${tenant.name}`);
  } else {
    console.log(`Using tenant: ${tenant.name}`);
  }

  const { normalizedEmail, location } = await ensureInfrastructure(tenant);
  console.log(`User ready: ${normalizedEmail}`);

  const [rooms, strains] = await Promise.all([
    Room.find({ tenantId: tenant._id, locationId: location._id }).lean(),
    Strain.find({ tenantId: tenant._id }).lean(),
  ]);

  console.log("Clearing batches, harvests, and assignments...\n");
  await clearOperationalData(tenant._id);

  console.log(`Seeding Riverbend Campus (${rooms.length} rooms, ${strains.length} strains)...`);

  const result = await seedLocationGrowData({
    tenantId: tenant._id,
    location,
    rooms,
    strains,
    batchPrefix: "GV",
    harvestPrefix: "H-GV",
    historicalWeeks: 24,
    strainsPerBatchMin: 12,
    strainsPerBatchMax: 16,
    totalPlantsBase: 268,
    cloneBatchCount: 4,
    momBatchCount: 4,
  });

  const summary = {
    batches: await Batch.countDocuments({ tenantId: tenant._id }),
    harvests: await Harvest.countDocuments({ tenantId: tenant._id }),
    assignments: await RoomAssignment.countDocuments({
      tenantId: tenant._id,
      active: true,
    }),
  };

  console.log(
    `  Created ${result.batches} batches, ${result.harvests} harvests, ${result.assignments} active assignments`,
  );
  console.log("\nGreen Valley reseed complete:");
  console.log(`  Strains:            ${strains.length}`);
  console.log(`  Batches:            ${summary.batches}`);
  console.log(`  Harvests:           ${summary.harvests}`);
  console.log(`  Active assignments: ${summary.assignments}`);
  console.log("\nLogin:");
  console.log(`  Email:    ${normalizedEmail}`);
  console.log(`  Password: ${USER_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
