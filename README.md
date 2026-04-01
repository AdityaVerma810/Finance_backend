# Finance Data Processing and Access Control Backend

A backend system for managing financial records with role-based access control. Built using Node.js, Express, and SQLite.

---.......................................................

## What this project does

This is a backend API for a finance dashboard develpoed by Aditya Verma. Different types of users (admin, analyst, viewer) have different levels of access. An admin can manage everything, an analyst can read and create records, and a viewer can only see summary data.

The main features are:
- User registration and login with JWT tokens
- Role-based access control on every route
- CRUD operations for financial records (income/expense entries)
- Dashboard APIs for summary, category breakdown, and monthly/weekly trends
- Input validation and proper error responses throughout

---..........................................................

## Tech used

- **Node.js + Express** — for the server and routing
- **SQLite (better-sqlite3)** — lightweight database, no setup needed, file is created automatically
- **JWT (jsonwebtoken)** — for authentication tokens
- **bcryptjs** — for hashing passwords
- **express-validator** — for request input validation

I chose SQLite because it keeps setup simple and is perfectly fine for this kind of assignment. In a real project I'd probably use PostgreSQL.

---..............................................

## Project structure

```
finance-backend/
├── src/
│   ├── index.js              # Entry point, server setup
│   ├── models/
│   │   └── db.js             # Database init, schema creation, seed data
│   ├── middleware/
│   │   └── auth.js           # JWT verification, role checking
│   └── routes/
│       ├── auth.js           # Login, register, /me
│       ├── users.js          # User management (admin focused)
│       ├── records.js        # Financial records CRUD
│       └── dashboard.js      # Summary and analytics APIs
├── data/                     # SQLite DB file gets created here
├── package.json
└── README.md
```...................................................................

---

## How to run

###1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
npm start
```

Or with auto-reload during development:

```bash
npm run dev
```

Server starts at `http://localhost:3000`

The SQLite database file is created automatically at `data/finance.db` and three default users are seeded on first run.

---

## Default users (seeded automatically)

| Role    | Email                  | Password    |
|---------|------------------------|-------------|
| Admin   | admin@finance.com      | admin123    |
| Analyst | analyst@finance.com    | analyst123  |
| Viewer  | viewer@finance.com     | viewer123   |

---

## API Reference

All protected routes need a Bearer token in the Authorization header:
```
Authorization: Bearer <your_token_here>
```

### Auth

| Method | Endpoint          | Access | Description              |
|--------|-------------------|--------|--------------------------|
| POST   | /api/auth/register | Public | Register new user        |
| POST   | /api/auth/login   | Public | Login, get token         |
| GET    | /api/auth/me      | All    | Get current user info    |

**Register body:**
```json
{
  "name": "John",
  "email": "john@example.com",
  "password": "pass123",
  "role": "viewer"
}
```

**Login body:**
```json
{
  "email": "admin@finance.com",
  "password": "admin123"
}
```

---

### Users

| Method | Endpoint        | Access       | Description              |
|--------|-----------------|--------------|--------------------------|
| GET    | /api/users      | Admin        | List all users           |
| GET    | /api/users/:id  | Admin / Self | Get user by ID           |
| POST   | /api/users      | Admin        | Create user              |
| PATCH  | /api/users/:id  | Admin / Self | Update user              |
| DELETE | /api/users/:id  | Admin        | Delete user              |

Query params for GET /api/users: `?status=active&role=analyst`

---

### Financial Records

| Method | Endpoint          | Access              | Description                 |
|--------|-------------------|---------------------|-----------------------------|
| GET    | /api/records      | All roles           | List records (with filters) |
| GET    | /api/records/:id  | All roles           | Get single record           |
| POST   | /api/records      | Analyst, Admin      | Create record               |
| PATCH  | /api/records/:id  | Analyst, Admin      | Update record               |
| DELETE | /api/records/:id  | Admin only          | Soft delete record          |

**Filter options for GET /api/records:**
```
?type=income
?type=expense
?category=salary
?from_date=2024-01-01
?to_date=2024-12-31
?page=1&limit=20
```

**Create record body:**
```json
{
  "amount": 5000,
  "type": "income",
  "category": "Salary",
  "date": "2024-06-15",
  "notes": "Monthly salary"
}
```

---

### Dashboard

All dashboard routes need at minimum viewer role. Some endpoints are restricted to analyst/admin.

| Method | Endpoint                     | Access          | Description                    |
|--------|------------------------------|-----------------|--------------------------------|
| GET    | /api/dashboard/summary       | All roles       | Total income, expense, balance |
| GET    | /api/dashboard/by-category   | Analyst, Admin  | Category wise breakdown        |
| GET    | /api/dashboard/monthly-trend | Analyst, Admin  | Month by month totals          |
| GET    | /api/dashboard/weekly-trend  | Analyst, Admin  | Last 8 weeks data              |
| GET    | /api/dashboard/recent        | All roles       | Recent transactions            |

Query params:
- `/by-category?type=expense`
- `/monthly-trend?year=2024`
- `/recent?limit=20`

---

## Role permissions summary

| Action                        | Viewer | Analyst | Admin |
|-------------------------------|--------|---------|-------|
| View financial records        | ✅     | ✅      | ✅    |
| View dashboard summary        | ✅     | ✅      | ✅    |
| View category/trend analytics | ❌     | ✅      | ✅    |
| Create financial records      | ❌     | ✅      | ✅    |
| Update financial records      | ❌     | ✅      | ✅    |
| Delete financial records      | ❌     | ❌      | ✅    |
| Manage users                  | ❌     | ❌      | ✅    |

---

## Assumptions I made

1. **Soft delete for records** — When a record is deleted it is just marked as `is_deleted = 1` in the database. This way data is not permanently lost. Admin can still see it if needed (can be extended later).

2. **Analyst can create and update records but not delete** — This felt logical because analysts deal with the data day to day but destructive actions should be admin only.

3. **Viewers get restricted dashboard** — Viewers can see the total summary (income, expenses, net) but cannot see category breakdowns or trends. I thought this was a reasonable default for a "read-only" role.

4. **JWT expires in 24 hours** — Kept it simple, no refresh token logic. For a production system I'd add refresh tokens.


5. **SQLite for storage** — Picked SQLite for zero-config simplicity. The database file is created automatically and the schema runs on startup.

6. **No separate permissions table** — Role-based logic is handled directly in middleware using the three defined roles. A permissions table would make it more flexible but felt like overkill for this assignment.



---

## Error handling

The API returns consistent error responses:

```json
{ "error": "Some descriptive message here" }
```

Or for validation errors:
```json
{
  "errors": [
    { "field": "email", "msg": "Valid email is required" }
  ]
}
```

HTTP status codes used:
- `200` — success
- `201` — created
- `400` — bad input / validation failed
- `401` — not authenticated
- `403` — not authorized (wrong role)
- `404` — resource not found
- `409` — conflict (eg. email already exists)
- `500` — unexpected server error

---

## What I'd improve with more time

- Add refresh token support
- Add rate limiting (easy with express-rate-limit)
- Write unit tests for service layer and integration tests for routes
- Add search across records (full text search)
- Export records to CSV
- Audit log table to track who changed what and when
