// =============================================
//   DATABASE SETUP — sql.js (Pure JS SQLite)
//   No native compilation needed!
// =============================================

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// On Azure App Service, /home/data is the persistent writable storage.
// Locally, we use the backend directory.
const DB_DIR = process.env.WEBSITE_SITE_NAME
  ? '/home/data'
  : __dirname;
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'events.db');

let db = null;

// ---- SQL helpers (synchronous-style interface matching better-sqlite3) ----
class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
  }
  get(...params) {
    const results = this._db.exec(this._sql, params.length ? params : undefined);
    if (!results.length || !results[0].values.length) return undefined;
    const cols = results[0].columns;
    const row = results[0].values[0];
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  }
  all(...params) {
    const results = this._db.exec(this._sql, params.length ? params : undefined);
    if (!results.length) return [];
    const cols = results[0].columns;
    return results[0].values.map(row => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }
  run(...params) {
    this._db.run(this._sql, params.length ? params : undefined);
    persist();
    return this;
  }
}

class SqlJsWrapper {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
  }
  prepare(sql) {
    return new Statement(this._db, sql);
  }
  exec(sql) {
    this._db.exec(sql);
    persist();
    return this;
  }
  pragma(statement) {
    try { this._db.exec(`PRAGMA ${statement}`); } catch (_) { }
    return this;
  }
}

// ---- Persist DB to disk ----
function persist() {
  if (!db) return;
  const data = db._db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ---- Initialize ----
async function initDb() {
  const SQL = await initSqlJs();

  let sqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }

  db = new SqlJsWrapper(sqlJsDb);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      date         TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'general',
      priority     TEXT NOT NULL DEFAULT 'normal',
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
      updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
    );
  `);

  console.log('✅ Database initialized:', DB_PATH);
  return db;
}

module.exports = { initDb, getDb: () => db };
