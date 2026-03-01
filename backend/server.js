require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Create the Express app instance.
const app = express();
// Use env var when available, otherwise default to local port 5000.
const PORT = process.env.PORT || 5000;

// Middleware runs before route handlers.
// cors() allows requests from the frontend dev server.
app.use(cors());
// express.json() parses JSON request bodies into req.body.
app.use(express.json());

// Build MongoDB connection string (env first, local fallback second).
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

// Connect once when the server starts.
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Mount each feature router under its API prefix.
app.use("/api/strains", require("./routes/strains"));
app.use("/api/batches", require("./routes/batches"));
app.use("/api/companies", require("./routes/companies"));
app.use("/api/locations", require("./routes/locations"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/harvests", require("./routes/harvests"));
app.use("/api/harvest-data", require("./routes/harvestData"));
app.use("/api/dry-room-data", require("./routes/dryRoomData"));
app.use("/api/plant-room-data", require("./routes/plantRoomData"));
app.use("/api/strain-data", require("./routes/strainData"));

// Simple endpoint useful for checking whether the API process is alive.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Start listening for HTTP requests.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
