const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('./config.cjs');

const defaults = {
  theme: 'dark',
  units: 'binary',
  quarantineRetentionDays: 30,
  confirmDestructiveActions: true,
  moveToQuarantine: true,
  duplicateHashAlgorithm: 'sha256',
  scanMaxFiles: 50000,
};

const mandatoryProtectedPaths = [
  process.env.WINDIR || 'C:\\Windows',
  process.env.ProgramFiles || 'C:\\Program Files',
  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  config.appRoot,
];

let backend = null;
let readyPromise = null;
let settingsCache = buildInitialSettings();

function buildInitialSettings() {
  return {
    ...defaults,
    protectedPaths: [...mandatoryProtectedPaths],
  };
}

function cloneSettings(settings) {
  return {
    ...settings,
    protectedPaths: [...(settings.protectedPaths || [])],
  };
}

function normalizeDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function parseJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function hashPath(value) {
  return crypto.createHash('sha256').update(path.resolve(String(value)).toLowerCase()).digest('hex');
}

function normalizePathValue(value) {
  return path.resolve(String(value));
}

function normalizeSettingsFromRows(rows, protectedPaths) {
  const settings = { ...defaults };
  for (const row of rows) {
    settings[row.key] = parseJson(row.value);
  }
  settings.protectedPaths = protectedPaths;
  return settings;
}

function getSettings() {
  return cloneSettings(settingsCache);
}

function getDatabaseInfo() {
  const mysqlConfig = config.mysqlConfig || {};
  return {
    client: config.databaseClient,
    label: config.databaseLabel,
    location: config.databaseClient === 'sqlite'
      ? config.databasePath
      : `mysql://${mysqlConfig.host || '127.0.0.1'}:${mysqlConfig.port || 3306}/${mysqlConfig.database || 'free_win64_pc_cleaner'}`,
  };
}

function createSqliteBackend() {
  const { DatabaseSync } = require('node:sqlite');
  if (!config.databasePath) {
    throw new Error('SQLite database path is not configured.');
  }

  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  fs.mkdirSync(config.quarantineRoot, { recursive: true });

  const db = new DatabaseSync(config.databasePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS protected_paths (
      path_hash TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
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

  const upsertSetting = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const insertProtected = db.prepare(`
    INSERT OR IGNORE INTO protected_paths (path_hash, path) VALUES (?, ?)
  `);
  const selectSettings = db.prepare('SELECT key, value FROM settings ORDER BY key');
  const selectProtected = db.prepare('SELECT path FROM protected_paths ORDER BY path');
  const insertActivity = db.prepare('INSERT INTO activity (action, detail, freed_bytes, created_at) VALUES (?, ?, ?, ?)');
  const insertQuarantine = db.prepare(`
    INSERT INTO quarantine_items
      (id, original_path, stored_path, size_bytes, category, deleted_at, expires_at, is_directory)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectQuarantine = db.prepare(`
    SELECT id, original_path AS originalPath, stored_path AS storedPath, size_bytes AS sizeBytes,
           category, deleted_at AS deletedAt, expires_at AS expiresAt, is_directory AS isDirectory
    FROM quarantine_items ORDER BY deleted_at DESC
  `);
  const selectQuarantineItem = db.prepare('SELECT * FROM quarantine_items WHERE id = ?');
  const deleteQuarantineItem = db.prepare('DELETE FROM quarantine_items WHERE id = ?');
  const selectActivity = db.prepare(`
    SELECT id, action, detail, freed_bytes AS freedBytes, created_at AS createdAt
    FROM activity ORDER BY id DESC LIMIT ?
  `);
  const selectDisabled = db.prepare(`
    SELECT id, name, command, registry_path AS registryPath, scope, disabled_at AS disabledAt
    FROM disabled_startup ORDER BY name
  `);
  const selectDisabledItem = db.prepare('SELECT * FROM disabled_startup WHERE id = ?');
  const deleteDisabled = db.prepare('DELETE FROM disabled_startup WHERE id = ?');
  const upsertDisabled = db.prepare(`
    INSERT INTO disabled_startup (id, name, command, registry_path, scope, disabled_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      command = excluded.command,
      registry_path = excluded.registry_path,
      scope = excluded.scope,
      disabled_at = excluded.disabled_at
  `);

  function loadSettingsSnapshot() {
    const rows = selectSettings.all();
    const protectedPaths = selectProtected.all().map((row) => row.path);
    return normalizeSettingsFromRows(rows, protectedPaths);
  }

  function seedSettings() {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, value] of Object.entries(defaults)) {
        upsertSetting.run(key, JSON.stringify(value), new Date().toISOString());
      }
      for (const protectedPath of mandatoryProtectedPaths) {
        const normalized = normalizePathValue(protectedPath);
        insertProtected.run(hashPath(normalized), normalized);
      }
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {}
      throw error;
    }
  }

  seedSettings();

  return {
    async initialize() {
      settingsCache = loadSettingsSnapshot();
    },
    async loadSettings() {
      settingsCache = loadSettingsSnapshot();
      return settingsCache;
    },
    async updateSettings(patch = {}) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const [key, value] of Object.entries(patch)) {
          if (key === 'protectedPaths') continue;
          if (!(key in defaults)) continue;
          upsertSetting.run(key, JSON.stringify(value), new Date().toISOString());
        }
        if (Array.isArray(patch.protectedPaths)) {
          db.prepare('DELETE FROM protected_paths').run();
          for (const value of [...patch.protectedPaths, ...mandatoryProtectedPaths]) {
            if (typeof value === 'string' && value.trim()) {
              const normalized = normalizePathValue(value.trim());
              insertProtected.run(hashPath(normalized), normalized);
            }
          }
        }
        db.exec('COMMIT');
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {}
        throw error;
      }
      return this.loadSettings();
    },
    async logActivity(action, detail, freedBytes = null) {
      insertActivity.run(action, detail, freedBytes, new Date().toISOString());
    },
    async listActivity(limit) {
      return selectActivity.all(limit).map((row) => ({
        ...row,
        createdAt: normalizeDate(row.createdAt),
      }));
    },
    async insertQuarantineItem(item) {
      insertQuarantine.run(
        item.id,
        item.originalPath,
        item.storedPath,
        item.sizeBytes,
        item.category,
        item.deletedAt,
        item.expiresAt,
        item.isDirectory ? 1 : 0,
      );
    },
    async listQuarantine() {
      return selectQuarantine.all().map((item) => ({
        ...item,
        isDirectory: Boolean(item.isDirectory),
        deletedAt: normalizeDate(item.deletedAt),
        expiresAt: normalizeDate(item.expiresAt),
      }));
    },
    async getQuarantineItem(id) {
      const item = selectQuarantineItem.get(id);
      if (!item) return null;
      return {
        id: item.id,
        originalPath: item.original_path,
        storedPath: item.stored_path,
        sizeBytes: item.size_bytes,
        category: item.category,
        isDirectory: Boolean(item.is_directory),
        deletedAt: normalizeDate(item.deleted_at),
        expiresAt: normalizeDate(item.expires_at),
      };
    },
    async deleteQuarantineItem(id) {
      deleteQuarantineItem.run(id);
    },
    async getDisabledStartupEntries() {
      return selectDisabled.all().map((row) => ({
        ...row,
        path: row.command,
        registryPath: row.registryPath,
        publisher: row.scope,
        valueName: row.name,
        enabled: false,
        impact: 'medium',
        source: 'registry',
        disabledAt: normalizeDate(row.disabledAt),
      }));
    },
    async getDisabledStartupEntryById(id) {
      const item = selectDisabledItem.get(id);
      if (!item) return null;
      return {
        ...item,
        path: item.command,
        registryPath: item.registry_path,
        publisher: item.scope,
        valueName: item.name,
        enabled: false,
        impact: 'medium',
        source: 'registry',
        disabledAt: normalizeDate(item.disabled_at),
      };
    },
    async upsertDisabledStartupEntry(entry) {
      upsertDisabled.run(entry.id, entry.name, entry.command, entry.registryPath, entry.scope, new Date().toISOString());
    },
    async deleteDisabledStartupEntry(id) {
      deleteDisabled.run(id);
    },
    async close() {
      db.close();
    },
  };
}

function createMysqlBackend() {
  const mysql = require('mysql2/promise');
  const mysqlConfig = config.mysqlConfig || {};
  const database = mysqlConfig.database || 'free_win64_pc_cleaner';
  const shouldCreateDatabase = String(process.env.MYSQL_CREATE_DATABASE || '1') !== '0';
  const baseOptions = {
    host: mysqlConfig.host || '127.0.0.1',
    port: Number(mysqlConfig.port || 3306),
    user: mysqlConfig.user || 'root',
    password: mysqlConfig.password || '',
    waitForConnections: true,
    connectionLimit: 5,
    supportBigNumbers: true,
    bigNumberStrings: false,
    timezone: 'Z',
    charset: 'utf8mb4',
  };

  const escapeIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;

  let pool = null;

  async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async function execute(sql, params = []) {
    await pool.execute(sql, params);
  }

  async function withConnection(task) {
    const connection = await pool.getConnection();
    try {
      return await task(connection);
    } finally {
      connection.release();
    }
  }

  async function loadSettingsSnapshot() {
    const settingsRows = await query('SELECT `key`, value FROM settings ORDER BY `key`');
    const protectedRows = await query('SELECT path FROM protected_paths ORDER BY path');
    return normalizeSettingsFromRows(settingsRows, protectedRows.map((row) => row.path));
  }

  async function seedSettings() {
    await withConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        for (const [key, value] of Object.entries(defaults)) {
          await connection.execute(`
            INSERT INTO settings (\`key\`, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP(3))
            ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP(3)
          `, [key, JSON.stringify(value)]);
        }
        for (const protectedPath of mandatoryProtectedPaths) {
          const normalized = normalizePathValue(protectedPath);
          await connection.execute(`
            INSERT IGNORE INTO protected_paths (path_hash, path)
            VALUES (?, ?)
          `, [hashPath(normalized), normalized]);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
  }

  return {
    async initialize() {
      pool = mysql.createPool({ ...baseOptions, database });
      try {
        await execute('SELECT 1');
      } catch (error) {
        const unknownDatabase = error && (error.code === 'ER_BAD_DB_ERROR' || error.errno === 1049);
        if (!shouldCreateDatabase || !unknownDatabase) throw error;

        await pool.end();
        const adminPool = mysql.createPool({ ...baseOptions });
        try {
          await adminPool.execute(
            `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
          );
        } finally {
          await adminPool.end();
        }

        pool = mysql.createPool({ ...baseOptions, database });
        await execute('SELECT 1');
      }

      await execute(`
        CREATE TABLE IF NOT EXISTS settings (
          \`key\` VARCHAR(255) PRIMARY KEY,
          value LONGTEXT NOT NULL,
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
        )
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS protected_paths (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          path_hash CHAR(64) NOT NULL UNIQUE,
          path LONGTEXT NOT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS quarantine_items (
          id CHAR(36) PRIMARY KEY,
          original_path LONGTEXT NOT NULL,
          stored_path LONGTEXT NOT NULL,
          size_bytes BIGINT NOT NULL DEFAULT 0,
          category VARCHAR(191) NOT NULL,
          deleted_at DATETIME(3) NOT NULL,
          expires_at DATETIME(3) NOT NULL,
          is_directory TINYINT(1) NOT NULL DEFAULT 0
        )
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS activity (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          action VARCHAR(191) NOT NULL,
          detail LONGTEXT NOT NULL,
          freed_bytes BIGINT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )
      `);
      await execute(`
        CREATE TABLE IF NOT EXISTS disabled_startup (
          id CHAR(16) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          command LONGTEXT NOT NULL,
          registry_path LONGTEXT NOT NULL,
          scope VARCHAR(191) NOT NULL,
          disabled_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )
      `);

      await seedSettings();
      settingsCache = await loadSettingsSnapshot();
    },
    async loadSettings() {
      settingsCache = await loadSettingsSnapshot();
      return settingsCache;
    },
    async updateSettings(patch = {}) {
      await withConnection(async (connection) => {
        await connection.beginTransaction();
        try {
          for (const [key, value] of Object.entries(patch)) {
            if (key === 'protectedPaths') continue;
            if (!(key in defaults)) continue;
            await connection.execute(`
              INSERT INTO settings (\`key\`, value, updated_at)
              VALUES (?, ?, CURRENT_TIMESTAMP(3))
              ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP(3)
            `, [key, JSON.stringify(value)]);
          }
          if (Array.isArray(patch.protectedPaths)) {
            await connection.execute('DELETE FROM protected_paths');
            for (const value of [...patch.protectedPaths, ...mandatoryProtectedPaths]) {
              if (typeof value === 'string' && value.trim()) {
                const normalized = normalizePathValue(value.trim());
                await connection.execute(`
                  INSERT IGNORE INTO protected_paths (path_hash, path)
                  VALUES (?, ?)
                `, [hashPath(normalized), normalized]);
              }
            }
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      });
      return this.loadSettings();
    },
    async logActivity(action, detail, freedBytes = null) {
      await execute(
        'INSERT INTO activity (action, detail, freed_bytes) VALUES (?, ?, ?)',
        [action, detail, freedBytes],
      );
    },
    async listActivity(limit) {
      const rows = await query(`
        SELECT id, action, detail, freed_bytes AS freedBytes, created_at AS createdAt
        FROM activity ORDER BY id DESC LIMIT ?
      `, [limit]);
      return rows.map((row) => ({
        ...row,
        createdAt: normalizeDate(row.createdAt),
      }));
    },
    async insertQuarantineItem(item) {
      await execute(`
        INSERT INTO quarantine_items
          (id, original_path, stored_path, size_bytes, category, deleted_at, expires_at, is_directory)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.id,
        item.originalPath,
        item.storedPath,
        item.sizeBytes,
        item.category,
        item.deletedAt,
        item.expiresAt,
        item.isDirectory ? 1 : 0,
      ]);
    },
    async listQuarantine() {
      const rows = await query(`
        SELECT id, original_path AS originalPath, stored_path AS storedPath, size_bytes AS sizeBytes,
               category, deleted_at AS deletedAt, expires_at AS expiresAt, is_directory AS isDirectory
        FROM quarantine_items ORDER BY deleted_at DESC
      `);
      return rows.map((item) => ({
        ...item,
        isDirectory: Boolean(item.isDirectory),
        deletedAt: normalizeDate(item.deletedAt),
        expiresAt: normalizeDate(item.expiresAt),
      }));
    },
    async getQuarantineItem(id) {
      const rows = await query('SELECT * FROM quarantine_items WHERE id = ? LIMIT 1', [id]);
      const item = rows[0];
      if (!item) return null;
      return {
        id: item.id,
        originalPath: item.original_path,
        storedPath: item.stored_path,
        sizeBytes: item.size_bytes,
        category: item.category,
        isDirectory: Boolean(item.is_directory),
        deletedAt: normalizeDate(item.deleted_at),
        expiresAt: normalizeDate(item.expires_at),
      };
    },
    async deleteQuarantineItem(id) {
      await execute('DELETE FROM quarantine_items WHERE id = ?', [id]);
    },
    async getDisabledStartupEntries() {
      const rows = await query(`
        SELECT id, name, command, registry_path AS registryPath, scope, disabled_at AS disabledAt
        FROM disabled_startup ORDER BY name
      `);
      return rows.map((row) => ({
        ...row,
        path: row.command,
        publisher: row.scope,
        valueName: row.name,
        enabled: false,
        impact: 'medium',
        source: 'registry',
        disabledAt: normalizeDate(row.disabledAt),
      }));
    },
    async getDisabledStartupEntryById(id) {
      const rows = await query('SELECT * FROM disabled_startup WHERE id = ? LIMIT 1', [id]);
      const item = rows[0];
      if (!item) return null;
      return {
        ...item,
        path: item.command,
        registryPath: item.registry_path,
        publisher: item.scope,
        valueName: item.name,
        enabled: false,
        impact: 'medium',
        source: 'registry',
        disabledAt: normalizeDate(item.disabled_at),
      };
    },
    async upsertDisabledStartupEntry(entry) {
      await execute(`
        INSERT INTO disabled_startup (id, name, command, registry_path, scope, disabled_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          command = VALUES(command),
          registry_path = VALUES(registry_path),
          scope = VALUES(scope),
          disabled_at = CURRENT_TIMESTAMP(3)
      `, [entry.id, entry.name, entry.command, entry.registryPath, entry.scope]);
    },
    async deleteDisabledStartupEntry(id) {
      await execute('DELETE FROM disabled_startup WHERE id = ?', [id]);
    },
    async close() {
      if (pool) await pool.end();
    },
  };
}

async function initializeDatabase() {
  if (backend) return backend;
  if (!readyPromise) {
    readyPromise = (async () => {
      backend = config.databaseClient === 'mysql' ? createMysqlBackend() : createSqliteBackend();
      await backend.initialize();
      settingsCache = await backend.loadSettings();
      return backend;
    })().catch((error) => {
      readyPromise = null;
      backend = null;
      throw error;
    });
  }
  return readyPromise;
}

async function updateSettings(patch) {
  const db = await initializeDatabase();
  const result = await db.updateSettings(patch || {});
  settingsCache = cloneSettings(result);
  return getSettings();
}

async function logActivity(action, detail, freedBytes = null) {
  const db = await initializeDatabase();
  await db.logActivity(action, detail, freedBytes);
}

async function listActivity(limit) {
  const db = await initializeDatabase();
  return db.listActivity(limit);
}

async function insertQuarantineItem(item) {
  const db = await initializeDatabase();
  await db.insertQuarantineItem(item);
}

async function listQuarantine() {
  const db = await initializeDatabase();
  return db.listQuarantine();
}

async function getQuarantineItem(id) {
  const db = await initializeDatabase();
  return db.getQuarantineItem(id);
}

async function deleteQuarantineItem(id) {
  const db = await initializeDatabase();
  await db.deleteQuarantineItem(id);
}

async function getDisabledStartupEntries() {
  const db = await initializeDatabase();
  return db.getDisabledStartupEntries();
}

async function getDisabledStartupEntryById(id) {
  const db = await initializeDatabase();
  return db.getDisabledStartupEntryById(id);
}

async function upsertDisabledStartupEntry(entry) {
  const db = await initializeDatabase();
  await db.upsertDisabledStartupEntry(entry);
}

async function deleteDisabledStartupEntry(id) {
  const db = await initializeDatabase();
  await db.deleteDisabledStartupEntry(id);
}

async function closeDatabase() {
  if (!backend) return;
  const current = backend;
  backend = null;
  readyPromise = null;
  await current.close();
}

module.exports = {
  defaults,
  getSettings,
  getDatabaseInfo,
  initializeDatabase,
  updateSettings,
  logActivity,
  listActivity,
  insertQuarantineItem,
  listQuarantine,
  getQuarantineItem,
  deleteQuarantineItem,
  getDisabledStartupEntries,
  getDisabledStartupEntryById,
  upsertDisabledStartupEntry,
  deleteDisabledStartupEntry,
  closeDatabase,
};
