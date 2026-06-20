/**
 * requireLogin — runs before every protected API route.
 *
 * Flow:
 *   1. Read login token from header
 *   2. Find user in database
 *   3. Set req.user and req.tenantId (their company)
 *   4. Stop if login is invalid
 *   5. Ignore any tenantId the client tried to send
 *
 * After this runs, routes use req.tenantId on every database query.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me-in-production";

async function requireLogin(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Login required" });
    }

    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, JWT_SECRET);

    // Look up the user — tenant always comes from this record, not the token alone.
    const user = await User.findById(payload.userId).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ error: "Invalid login" });
    }

    if (!user.tenantId) {
      return res.status(403).json({ error: "Your account has no company assigned" });
    }

    req.user = user;
    req.tenantId = user.tenantId;

    // Reject if client tries to pick a different company.
    const clientTenant = req.body?.tenantId ?? req.query?.tenantId;
    if (
      clientTenant !== undefined &&
      String(clientTenant) !== String(req.tenantId)
    ) {
      return res.status(403).json({ error: "Not allowed" });
    }

    delete req.body?.tenantId;
    delete req.query?.tenantId;

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired login" });
  }
}

module.exports = { requireLogin, JWT_SECRET };
