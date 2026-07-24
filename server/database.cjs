const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('./config.cjs');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
fs.mkdirSync(config.quarantineRoot, { recursive: true });

const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS protected_paths (
    path TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quarantine_items (
    id TEXT PRIMARY KEY,
    original_path TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_directory INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    freed_bytes INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS disabled_startup (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    registry_path TEXT NOT NULL,
    scope TEXT NOT NULL,
    disabled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const defaults = {
  theme: 'dark',
  units: 'binary',
  quarantineRetentionDays: 30,
  confirmDestructiveActions: true,
  moveToQuarantine: true,
  duplicateHashAlgorithm: 'sha256',
  scanMaxFiles: 50000,
};

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
`);
for (const [key, value] of Object.entries(defaults)) {
  insertSetting.run(key, JSON.stringify(value));
}

const mandatoryProtectedPaths = [
  process.env.WINDIR || 'C:\\Windows',
  process.env.ProgramFiles || 'C:\\Program Files',
  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  config.appRoot,
];
const insertProtected = db.prepare('INSERT OR IGNORE INTO protected_paths (path) VALUES (?)');
for (const protectedPath of mandatoryProtectedPaths) insertProtected.run(protectedPath);

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const settings = {};
  for (const row of rows) {
    try { settings[row.key] = JSON.parse(row.value); }
    catch { settings[row.key] = row.value; }
  }
  settings.protectedPaths = db.prepare('SELECT path FROM protected_paths ORDER BY path').all().map((row) => row.path);
  return settings;
}

function updateSettings(patch) {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'protectedPaths') continue;
      if (!(key in defaults)) continue;
      upsert.run(key, JSON.stringify(value));
    }
    if (Array.isArray(patch.protectedPaths)) {
      db.prepare('DELETE FROM protected_paths').run();
      for (const value of [...patch.protectedPaths, ...mandatoryProtectedPaths]) {
        if (typeof value === 'string' && value.trim()) insertProtected.run(value.trim());
      }
    }
  });
  transaction();
  return getSettings();
}

function logActivity(action, detail, freedBytes = null) {
  db.prepare('INSERT INTO activity (action, detail, freed_bytes) VALUES (?, ?, ?)')
    .run(action, detail, freedBytes);
}

module.exports = { db, getSettings, updateSettings, logActivity };
