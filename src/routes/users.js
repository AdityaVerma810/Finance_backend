const express = require("express");
const bcrypt = require("bcryptjs");
const { body, param, validationResult } = require("express-validator");
const { getDb } = require("../models/db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// all user management routes require authentication
router.use(authenticate);

// GET /api/users - admin can list all, others see onlythemselves
router.get("/", authorize("admin"), (req, res) => {
  const { status, role } = req.query;
  const db = getDb();

  let query = "SELECT id, name, email, role, status, created_at FROM users WHERE 1=1";
  const params = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  if (role) {
    query += " AND role = ?";
    params.push(role);
  }

  query += " ORDER BY created_at DESC";
  const users = db.prepare(query).all(...params);
  return res.json({ users, total: users.length });
});

router.get("/:id", [param("id").isInt().withMessage("Invalid user ID")], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;

  // non-admins can only see their own profile
  if (req.user.role !== "admin" && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: "You can only view your own profile." });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?")
    .get(id);

  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user });
});

// POST /api/users - admin creates user
router.post(
  "/",
  authorize("admin"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("password").isLength({ min: 6 }).withMessage("Min 6 chars password"),
    body("role")
      .isIn(["viewer", "analyst", "admin"])
      .withMessage("Role must be viewer, analyst, or admin"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role } = req.body;
    const db = getDb();

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Email already exists." });

    const hashed = bcrypt.hashSync(password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
      .run(name, email, hashed, role);

    const user = db
      .prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({ message: "User created", user });
  }
);

// PATCH /api/users/:id - admin updates any user, others can update themselves (limited)
router.patch(
  "/:id",
  [param("id").isInt().withMessage("Invalid user ID")],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const isAdmin = req.user.role === "admin";
    const isSelf = req.user.id === parseInt(id);

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Not allowed to update this user." });
    }

    const db = getDb();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!user) return res.status(404).json({ error: "User not found." });

    const { name, status, role } = req.body;
    const updates = {};

    if (name) updates.name = name.trim();

    // only admin can change role and status
    if (isAdmin) {
      if (status && ["active", "inactive"].includes(status)) updates.status = status;
      if (role && ["viewer", "analyst", "admin"].includes(role)) updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    const values = [...Object.values(updates), id];
    db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...values);

    const updated = db
      .prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?")
      .get(id);
    return res.json({ message: "User updated", user: updated });
  }
);

// DELETE /api/users/:id - admin only
router.delete("/:id", authorize("admin"), [param("id").isInt()], (req, res) => {
  const { id } = req.params;
  const db = getDb();

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found." });

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return res.json({ message: "User deleted successfully." });
});

module.exports = router;
