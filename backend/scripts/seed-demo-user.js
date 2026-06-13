/**
 * Create a demo login user tied to the default tenant.
 *
 * Usage:
 *   npm run seed:demo-user
 *
 * Default credentials (override with env vars):
 *   Email:    admin@demo.local
 *   Password: demo1234
 */

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Tenant = require("../models/Tenant");
const User = require("../models/User");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || "admin@demo.local";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "demo1234";
const DEMO_NAME = process.env.DEMO_USER_NAME || "Demo Admin";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "default";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  let tenant = await Tenant.findOne({ slug: DEFAULT_TENANT_SLUG });

  if (!tenant) {
    tenant = await Tenant.create({
      name: "Default Tenant",
      slug: DEFAULT_TENANT_SLUG,
      status: "active",
    });
    console.log(`Created tenant: ${tenant.name} (${tenant._id})`);
  } else {
    console.log(`Using tenant: ${tenant.name} (${tenant._id})`);
  }

  const normalizedEmail = DEMO_EMAIL.trim().toLowerCase();
  let user = await User.findOne({
    tenantId: tenant._id,
    email: normalizedEmail,
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  if (user) {
    user.passwordHash = passwordHash;
    user.name = DEMO_NAME;
    user.role = "owner";
    await user.save();
    console.log(`Updated existing user: ${normalizedEmail}`);
  } else {
    user = await User.create({
      tenantId: tenant._id,
      email: normalizedEmail,
      passwordHash,
      name: DEMO_NAME,
      role: "owner",
    });
    console.log(`Created user: ${normalizedEmail}`);
  }

  console.log("\nDemo login ready:");
  console.log(`  Email:    ${normalizedEmail}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Tenant:   ${tenant._id}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
