const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { getDb } = require("../models/db");
const { generateToken,authenticate } = require("../middleware/auth");

const router =express.Router();

// POST /api/auth/register
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role")
      .optional()
      .isIn(["viewer","analyst","admin"])
      .withMessage("Role must be viewer, analyst,or admin"),
  ],
  (req,res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({errors: errors.array() });
    }

    const {name,email,password,role = "viewer" } = req.body;
    const db = getDb();

    const existing =db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const hashed =bcrypt.hashSync(password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
      .run(name, email, hashed, role);

    const user = db
      .prepare("SELECT id, name, email, role, status, created_at FROM users WHERE id = ?")
      .get(result.lastInsertRowid);

    const token = generateToken(user.id);
    return res.status(201).json({ message: "User registered successfully", user, token });
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const db = getDb();

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (user.status === "inactive") {
      return res.status(403).json({ error: "Account is deactivated. Contact admin." });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user.id);
    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  }
);

// GET /api/auth/me - geting current logged in user
router.get("/me", authenticate, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
