const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(filePath, override = false) {
  if (!fs.existsSync(filePath)) return;
  try {
    require('dotenv').config({ path: filePath, override });
  } catch (error) {
    if (error && error.code !== 'MODULE_NOT_FOUND') throw error;
  }
}

const rootDir = path.resolve(__dirname, '..');
loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.env.local'), true);

