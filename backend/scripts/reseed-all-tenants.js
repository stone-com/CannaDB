/**
 * Reseed operational grow data for both demo tenants.
 *
 * Usage:
 *   npm run seed:reseed-all
 */

require("dotenv").config();

const { execSync } = require("child_process");
const path = require("path");

const scriptsDir = __dirname;

function runScript(name) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running ${name}`);
  console.log("=".repeat(60));
  execSync(`node ${path.join(scriptsDir, name)}`, {
    stdio: "inherit",
    env: process.env,
  });
}

runScript("seed-default-batches.js");
runScript("seed-green-valley-tenant.js");

console.log("\nAll tenant grow data reseeded.");
