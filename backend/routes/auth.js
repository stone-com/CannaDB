const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Returns a token the frontend stores and sends on every API request.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Look up the user by email (demo setup uses one tenant for now).
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Compare typed password with the hashed password in the database.
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Create a signed token that expires in 7 days.
    const token = jwt.sign(
      {
        userId: user._id,
        tenantId: user.tenantId,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Returns the currently logged-in user (requires login token).
 */
router.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user._id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    tenantId: req.user.tenantId,
  });
});

module.exports = router;
