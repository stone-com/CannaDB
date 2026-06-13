const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Secret used to sign login tokens. Set JWT_SECRET in production.
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me-in-production";

/**
 * Protect API routes — user must send a valid login token.
 *
 * Frontend sends: Authorization: Bearer <token>
 *
 * On success this sets:
 *   req.user     — the logged-in user document
 *   req.tenantId — which organization this user belongs to
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    // Expect header format: "Bearer eyJhbGciOi..."
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Login required. Send Authorization: Bearer <token>",
      });
    }

    const token = authHeader.slice("Bearer ".length);

    // Decode and verify the token signature + expiry.
    const payload = jwt.verify(token, JWT_SECRET);

    // Load the user from the database (token only stores ids).
    const user = await User.findById(payload.userId).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ error: "Invalid token — user not found" });
    }

    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired login token" });
  }
}

module.exports = {
  requireAuth,
  JWT_SECRET,
};
