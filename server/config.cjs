const os = require('node:os');
const path = require('node:path');

const appRoot = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'FreeWin64PCCleaner')
  : path.join(os.homedir(), '.free-win64-pc-cleaner');

module.exports = {
  host: process.env.PC_CLEANER_HOST || '127.0.0.1',
  port: Number(process.env.PC_CLEANER_PORT || 3210),
  appRoot,
  databasePath: path.join(appRoot, 'data', 'cleaner.db'),
  quarantineRoot: path.join(appRoot, 'quarantine'),
};
