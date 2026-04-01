const Database =require("better-sqlite3");
const path =require("path");


const DB_PATH = path.join(__dirname, "../../data/finance.db");

let db;
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer', 'analyst', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  // seed a default admin so we can login right away
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@finance.com");
  if (!existing) {
    const bcrypt = require("bcryptjs");
    const hashed = bcrypt.hashSync("admin123", 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role, status)
      VALUES (?, ?, ?, 'admin', 'active')
    `).run("Admin User", "admin@finance.com", hashed);

    // also seed a viewer and analyst for testing
    const viewerHash = bcrypt.hashSync("viewer123", 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role, status)
      VALUES (?, ?, ?, 'viewer', 'active')
    `).run("Test Viewer", "viewer@finance.com", viewerHash);

    const analystHash = bcrypt.hashSync("analyst123", 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role, status)
      VALUES (?, ?, ?, 'analyst', 'active')
    `).run("Test Analyst", "analyst@finance.com", analystHash);

    console.log("Seeded default users (admin, viewer, analyst)");
  }

  console.log("Database initialized");
}

module.exports = { getDb, initDb };
