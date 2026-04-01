const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { getDb } = require("../models/db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/records - viewers, analysts, admins can all veiew
router.get("/", (req, res) => {
  const db = getDb();
  const { type, category, from_date, to_date, page = 1, limit = 20 } = req.query;

  let query = "SELECT r.*, u.name as created_by_name FROM financial_records r JOIN users u ON r.created_by = u.id WHERE r.is_deleted = 0";
  const params = [];

  if (type && ["income", "expense"].includes(type)) {
    query += " AND r.type = ?";
    params.push(type);
  }
  if (category) {
    query += " AND r.category LIKE ?";
    params.push(`%${category}%`);
  }
  if (from_date) {
    query += " AND r.date >= ?";
    params.push(from_date);
  }
  if (to_date) {
    query += " AND r.date <= ?";
    params.push(to_date);
  }

  query += " ORDER BY r.date DESC, r.created_at DESC";

  
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const countQuery = query.replace(
    "SELECT r.*, u.name as created_by_name",
    "SELECT COUNT(*) as total"
  );
  const { total } = db.prepare(countQuery).get(...params);

  query += " LIMIT ? OFFSET ?";
  params.push(limitNum, offset);

  const records = db.prepare(query).all(...params);

  return res.json({
    records,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    },
  });
});

// GET /api/records/:id
router.get("/:id", [param("id").isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const record = db
    .prepare(
      "SELECT r.*, u.name as created_by_name FROM financial_records r JOIN users u ON r.created_by = u.id WHERE r.id = ? AND r.is_deleted = 0"
    )
    .get(req.params.id);

  if (!record) return res.status(404).json({ error: "Record not found." });
  return res.json({ record });
});

// POST /api/records -analyst and admin can create
router.post(
  "/",
  authorize("analyst", "admin"),
  [
    body("amount").isFloat({ gt: 0 }).withMessage("Amount must be a positive number"),
    body("type").isIn(["income", "expense"]).withMessage("Type must be income or expense"),
    body("category").trim().notEmpty().withMessage("Category is required"),
    body("date").isDate().withMessage("Date must be valid (YYYY-MM-DD)"),
    body("notes").optional().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, type, category, date, notes } = req.body;
    const db = getDb();

    const result = db
      .prepare(
        "INSERT INTO financial_records (amount, type, category, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(amount, type, category.trim(), date, notes || null, req.user.id);

    const record = db
      .prepare("SELECT * FROM financial_records WHERE id = ?")
      .get(result.lastInsertRowid);

    return res.status(201).json({ message: "Record created", record });
  }
);

// PATCH /api/records/:id - analyst and admin can update
router.patch(
  "/:id",
  authorize("analyst", "admin"),
  [param("id").isInt()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();
    const record = db
      .prepare("SELECT * FROM financial_records WHERE id = ? AND is_deleted = 0")
      .get(req.params.id);

    if (!record) return res.status(404).json({ error: "Record not found." });

    const { amount, type, category, date, notes } = req.body;
    const updates = {};

    if (amount !== undefined) {
      if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number." });
      }
      updates.amount = parseFloat(amount);
    }
    if (type !== undefined) {
      if (!["income", "expense"].includes(type)) {
        return res.status(400).json({ error: "Type must be income or expense." });
      }
      updates.type = type;
    }
    if (category !== undefined) updates.category = category.trim();
    if (date !== undefined) updates.date = date;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    updates.updated_at = new Date().toISOString();
    const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    const values = [...Object.values(updates), req.params.id];

    db.prepare(`UPDATE financial_records SET ${setClauses} WHERE id = ?`).run(...values);

    const updated = db.prepare("SELECT * FROM financial_records WHERE id = ?").get(req.params.id);
    return res.json({ message: "Record updated", record: updated });
  }
);

// DELETE /api/records/:id - soft delete, admin only
router.delete("/:id", authorize("admin"), [param("id").isInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const db = getDb();
  const record = db
    .prepare("SELECT * FROM financial_records WHERE id = ? AND is_deleted = 0")
    .get(req.params.id);

  if (!record) return res.status(404).json({ error: "Record not found." });

  db.prepare(
    "UPDATE financial_records SET is_deleted = 1, updated_at = ? WHERE id = ?"
  ).run(new Date().toISOString(), req.params.id);

  return res.json({ message: "Record deleted (soft delete)." });
});

module.exports = router;
