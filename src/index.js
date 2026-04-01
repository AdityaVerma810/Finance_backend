const express = require("express");
const { initDb } = require("./models/db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const recordRoutes = require("./routes/records");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/dashboard", dashboardRoutes);

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Finance backend is running" });
});

// 404handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// global error handler
app.use((err, req, res, next) => {
  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// init db then start server
initDb();
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`\nDefault login credentials:`);
  console.log(`  Admin   -> admin@finance.com   / admin123`);
  console.log(`  Analyst -> analyst@finance.com / analyst123`);
  console.log(`  Viewer  -> viewer@finance.com  / viewer123`);
});

module.exports = app;
