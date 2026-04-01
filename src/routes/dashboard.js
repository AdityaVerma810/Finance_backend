const express = require("express");
const { getDb } = require("../models/db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.use(authorize("viewer", "analyst", "admin"));

// GET /api/dashboard/summary -overalll totals
router.get("/summary", (req, res) => {
  const db = getDb();

  const totals = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) AS net_balance,
        COUNT(*) AS total_records
      FROM financial_records
      WHERE is_deleted = 0
    `)
    .get();

  // viewers only get basic summary,no breakdownn
  if (req.user.role === "viewer") {
    return res.json({
      summary: {
        total_income: totals.total_income,
        total_expenses: totals.total_expenses,
        net_balance: totals.net_balance,
      },
      note: "Detailed breakdowns are available for analyst and admin roles.",
    });
  }

  return res.json({ summary: totals });
});

// GET /api/dashboardd/by-category - category wise totals
router.get("/by-category", authorize("analyst", "admin"), (req, res) => {
  const db = getDb();
  const { type } = req.query;

  let query = `
    SELECT
      category,
      type,
      COUNT(*) as count,
      SUM(amount) as total
    FROM financial_records
    WHERE is_deleted = 0
  `;
  const params = [];

  if (type && ["income", "expense"].includes(type)) {
    query += " AND type = ?";
    params.push(type);
  }

  query += " GROUP BY category, type ORDER BY total DESC";

  const categories = db.prepare(query).all(...params);
  return res.json({ categories });
});

// GET /api/dashboard/monthly-trend - month by month breakdown
router.get("/monthly-trend", authorize("analyst", "admin"), (req, res) => {
  const db = getDb();
  const { year } = req.query;

  let query = `
    SELECT
      strftime('%Y-%m', date) AS month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses,
      SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net
    FROM financial_records
    WHERE is_deleted = 0
  `;
  const params = [];

  if (year) {
    query += " AND strftime('%Y', date) = ?";
    params.push(String(year));
  }

  query += " GROUP BY month ORDER BY month DESC";

  const trend = db.prepare(query).all(...params);
  return res.json({ trend });
});

// GET /api/dashboard/weekly-trend -elast 8 weeks
router.get("/weekly-trend", authorize("analyst", "admin"), (req, res) => {
  const db = getDb();

  const trend = db
    .prepare(`
      SELECT
        strftime('%Y-W%W', date) AS week,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net
      FROM financial_records
      WHERE is_deleted = 0
        AND date >= date('now', '-8 weeks')
      GROUP BY week
      ORDER BY week DESC
    `)
    .all();

  return res.json({ trend });
});

// GET /api/dashboard/recent -recent 10 transactions
router.get("/recent", (req, res) => {
  const db = getDb();
  const limit = Math.min(50, parseInt(req.query.limit) || 10);

  const records = db
    .prepare(`
      SELECT r.id, r.amount, r.type, r.category, r.date, r.notes, u.name as created_by_name
      FROM financial_records r
      JOIN users u ON r.created_by = u.id
      WHERE r.is_deleted = 0
      ORDER BY r.date DESC, r.created_at DESC
      LIMIT ?
    `)
    .all(limit);

  return res.json({ records });
});

module.exports = router;
