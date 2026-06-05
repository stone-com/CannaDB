const express = require("express");
const router = express.Router();
const Strain = require("../models/Strain");

// Strain create/read endpoints.

// Create strain.
router.post("/", async (req, res) => {
  try {
    const { name, type, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Strain name is required" });
    }

    const strain = new Strain({
      name,
      type: type || null,
      status: status || null,
    });

    const savedStrain = await strain.save();
    res.status(201).json(savedStrain);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Strain name must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// List strains.
router.get("/", async (req, res) => {
  try {
    const strains = await Strain.find();
    res.json(strains);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one strain.
router.get("/:id", async (req, res) => {
  try {
    const strain = await Strain.findById(req.params.id);
    if (!strain) {
      return res.status(404).json({ error: "Strain not found" });
    }
    res.json(strain);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
