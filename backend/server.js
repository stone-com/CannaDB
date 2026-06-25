require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { requireLogin } = require("./middleware/requireLogin");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cannabis-inventory";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// PUBLIC ROUTES (no login required)
app.get("/api/health", (req, res) => {
  const stateByCode = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  app.get("/api/ping", (req, res) => {
    res.status(200).send("Awake");
  });

  const dbStateCode = mongoose.connection.readyState;
  const dbState = stateByCode[dbStateCode] || "unknown";
  const healthy = dbStateCode === 1;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    message: "Server is running",
    database: {
      state: dbState,
      readyState: dbStateCode,
    },
  });
});

app.use("/api/auth", require("./routes/auth"));

// PROTECTED ROUTES — requireLogin runs first and sets req.user + req.tenantId
app.use(requireLogin);

app.use("/api/strains", require("./routes/strains"));
app.use("/api/batches", require("./routes/batches"));
app.use("/api/room-assignments", require("./routes/roomAssignments"));
app.use("/api/companies", require("./routes/companies"));
app.use("/api/locations", require("./routes/locations"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/harvests", require("./routes/harvests"));
app.use("/api/audit-logs", require("./routes/auditLogs"));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
