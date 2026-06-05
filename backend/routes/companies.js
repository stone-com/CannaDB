const express = require("express");
const router = express.Router();
const Company = require("../models/Company");

// Company create/read endpoints.

// Create company.
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const company = new Company({ name });
    const savedCompany = await company.save();
    res.status(201).json(savedCompany);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Company name must be unique" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// List companies.
router.get("/", async (req, res) => {
  try {
    const companies = await Company.find();
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one company.
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
