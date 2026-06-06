const express = require("express");
const router = express.Router();
const Location = require("../models/Location");

// Location create/read endpoints.

// Create location.
router.post("/", async (req, res) => {
  try {
    const { companyId, nickname, address } = req.body;

    if (!companyId || !nickname) {
      return res
        .status(400)
        .json({ error: "companyId and nickname are required" });
    }

    // Create the location document from the form data.
    const location = new Location({
      companyId,
      nickname,
      address: address || null,
    });

    // Save first, then populate company details for the response.
    const savedLocation = await location.save();
    const populatedLocation = await savedLocation.populate("companyId");
    res.status(201).json(populatedLocation);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        error: "A location with this nickname already exists for that company",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// List locations with company data.
router.get("/", async (req, res) => {
  try {
    // Return all locations and include the related company for each one.
    const locations = await Location.find().populate("companyId");
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one location with company data.
router.get("/:id", async (req, res) => {
  try {
    // Return one location and include its company details.
    const location = await Location.findById(req.params.id).populate(
      "companyId",
    );
    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
