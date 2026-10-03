/**
 * Shared D1 access + schema adapter for the auth functions.
 *
 * The `users` table already exists in this account's D1 instance because the
 * older fashionistas-api Worker created it with a different shape:
 *
 *     users(id, username, password_hash, display_name, email, ...)
 *
 * while this code wants (email, pass_hash, salt). `CREATE TABLE IF NOT EXISTS`
 * is a no-op against a table that already exists, and a bare INSERT then fails
 * with "no such column: pass_hash" — or with a NOT NULL violation on username.
 *
 * So: create the table if it is genuinely absent, then introspect it with
 * PRAGMA table_info and ALTER in whichever columns are missing. Writes go
 * through insertUser(), which only names columns that exist.
 */

const NEW_USER_COLUMNS = [
  { name: "email", ddl: "TEXT" },
  { name: "username", ddl: "TEXT" },
  { name: "display_name", ddl: "TEXT" },
  { name: "pass_hash", ddl: "TEXT" },
  { name: "salt", ddl: "TEXT" },
  { name: "password_hash", ddl: "TEXT" },
];

/** First binding on env that actually looks like a D1 database. */
export function getDB(env) {
  for (const name of ["DB", "FASHIONISTAS_DB", "EBAY_DB", "EBAY_TOKENS_DB", "D1", "DATABASE"]) {
    const candidate = env ? env[name] : null;
    if (candidate && typeof candidate.prepare === "function") return candidate;
  }
  return null;
}

async function exec(db, sql) {
  try {
    await db.prepare(sql).run();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/** Column names present on a table right now (lowercased). */
async function columns(db, table) {
  try {
    const res = await db.prepare(`PRAGMA table_info(${table})`).all();
    const rows = (res && res.results) || [];
    return new Set(rows.map((r) => String(r.name).toLowerCase()));
  } catch {
    return new Set();
  }
}

/**
 * Make sure `users` and `sessions` exist and contain every column we read or
 * write. Safe to call on every request: it only issues DDL when something is
 * actually missing.
 */
export async function ensureAuthSchema(db) {
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT,
      display_name TEXT,
      pass_hash TEXT,
      salt TEXT,
      password_hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await exec(
    db,
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const have = await columns(db, "users");
  for (const col of NEW_USER_COLUMNS) {
    if (!have.has(col.name)) {
      await exec(db, `ALTER TABLE users ADD COLUMN ${col.name} ${col.ddl}`);
    }
  }

  const haveSessions = await columns(db, "sessions");
  for (const [name, ddl] of [
    ["user_id", "INTEGER"],
    ["token", "TEXT"],
    ["expires_at", "INTEGER"],
    ["created_at", "TEXT"],
  ]) {
    if (!haveSessions.has(name)) {
      await exec(db, `ALTER TABLE sessions ADD COLUMN ${name} ${ddl}`);
    }
  }
}

/** Username the legacy NOT NULL column needs; derived from the email. */
function usernameFor(email) {
  return String(email).split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 32) || "seller";
}

/**
 * Insert a user using only columns that exist on the live table.
 * Returns { id } or throws with the underlying D1 error.
 */
export async function insertUser(db, { email, passHash, salt }) {
  const have = await columns(db, "users");
  const values = [
    ["email", email],
    ["username", usernameFor(email)],
    ["display_name", usernameFor(email)],
    ["pass_hash", passHash],
    ["salt", salt],
    // legacy column: the old Worker compares this field directly
    ["password_hash", passHash],
  ].filter(([name]) => have.has(name));

  const cols = values.map(([n]) => n).join(", ");
  const marks = values.map(() => "?").join(", ");
  const row = await db
    .prepare(`INSERT INTO users (${cols}) VALUES (${marks})`)
    .bind(...values.map(([, v]) => v))
    .run();
  return { id: row && row.meta && row.meta.last_row_id };
}

/** Look a user up by email (and fall back to username for legacy rows). */
export async function findByEmail(db, email) {
  const have = await columns(db, "users");
  if (have.has("email")) {
    const byEmail = await db
      .prepare("SELECT id, email, pass_hash, salt, password_hash FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (byEmail) return byEmail;
  }
  if (have.has("username")) {
    const byName = await db
      .prepare("SELECT id, email, pass_hash, salt, password_hash FROM users WHERE username = ?")
      .bind(usernameFor(email))
      .first();
    if (byName) return byName;
  }
  return null;
}
