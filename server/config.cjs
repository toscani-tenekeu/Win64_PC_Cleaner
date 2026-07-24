require('./env.cjs');
const os = require('node:os');
const path = require('node:path');

const appRoot = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'FreeWin64PCCleaner')
  : path.join(os.homedir(), '.free-win64-pc-cleaner');

function normalizeDatabaseClient(value) {
  const candidate = String(value || '').trim().toLowerCase();
  if (candidate === 'mysql') return 'mysql';
  if (candidate === 'sqlite') return 'sqlite';
  return process.env.DATABASE_URL && /^mysql/i.test(process.env.DATABASE_URL) ? 'mysql' : 'sqlite';
}

function parseMysqlUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/^mysql/i.test(parsed.protocol)) return null;
    const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || null;
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database,
    };
  } catch {
    return null;
  }
}

const databaseClient = normalizeDatabaseClient(process.env.DB_CLIENT);
const sqliteDatabasePath = process.env.SQLITE_DATABASE_PATH || path.join(appRoot, 'data', 'cleaner.db');
const mysqlUrl = process.env.DATABASE_URL || null;
const mysqlConfig = parseMysqlUrl(mysqlUrl) || {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'free_win64_pc_cleaner',
};

function describeDatabase() {
  if (databaseClient === 'mysql') {
    const host = mysqlConfig.host || '127.0.0.1';
    const database = mysqlConfig.database || 'free_win64_pc_cleaner';
    return `MySQL (${host}:${mysqlConfig.port}/${database})`;
  }
  return `SQLite (${path.basename(sqliteDatabasePath)})`;
}

module.exports = {
  host: process.env.PC_CLEANER_HOST || '127.0.0.1',
  port: Number(process.env.PC_CLEANER_PORT || 3210),
  databaseClient,
  databaseUrl: mysqlUrl,
  mysqlConfig,
  appRoot,
  databasePath: databaseClient === 'sqlite' ? sqliteDatabasePath : null,
  databaseLabel: describeDatabase(),
  quarantineRoot: path.join(appRoot, 'quarantine'),
};
