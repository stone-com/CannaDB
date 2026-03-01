const express = require("express");
// express.Router() creates a mini-router for this feature.
const router = express.Router();
const Company = require("../models/Company");

// Company CRUD endpoints.
// Each handler is async so we can await database calls.

// Create a new company
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Company name is required" });
    }

    // Create a Mongoose document instance from request data.
    const company = new Company({ name });

    // .save() writes the document to MongoDB.
    const savedCompany = await company.save();
    res.status(201).json(savedCompany);
  } catch (error) {
    // Mongo duplicate-key error code.
    if (error.code === 11000) {
      res.status(400).json({ error: "Company name must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Return all companies.
router.get("/", async (req, res) => {
  try {
    const companies = await Company.find();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Return one company by ID.
router.get("/:id", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
