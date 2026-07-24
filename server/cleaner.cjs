const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { sizeOf, trashPath } = require('./filesystem.cjs');
const { logActivity } = require('./database.cjs');

function existing(paths) {
  return [...new Set(paths.filter(Boolean).map((value) => path.resolve(value)))].filter((value) => fs.existsSync(value));
}

function firefoxCacheRoots(roaming) {
  const profilesRoot = path.join(roaming, 'Mozilla', 'Firefox', 'Profiles');
  if (!fs.existsSync(profilesRoot)) return [];
  try {
    return fs.readdirSync(profilesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => [
        path.join(profilesRoot, entry.name, 'cache2'),
        path.join(profilesRoot, entry.name, 'startupCache'),
      ]);
  } catch {
    return [];
  }
}

function cleanupDefinitions() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const windows = process.env.WINDIR || 'C:\\Windows';
  return [
    {
      id: 'user-temp', name: 'User temporary files', risk: 'safe',
      description: 'Temporary files for the current Windows user.',
      roots: existing([process.env.TEMP, path.join(local, 'Temp')]),
    },
    {
      id: 'win-temp', name: 'Windows temporary files', risk: 'review', requiresAdmin: true,
      description: 'Temporary files created by Windows and installers.',
      roots: existing([path.join(windows, 'Temp')]),
    },
    {
      id: 'thumbnails', name: 'Thumbnail cache', risk: 'safe',
      description: 'Explorer thumbnail databases; Windows recreates them automatically.',
      roots: existing([path.join(local, 'Microsoft', 'Windows', 'Explorer')]),
      include: (name) => /^thumbcache_.*\.db$/i.test(name),
    },
    {
      id: 'dx-shader', name: 'DirectX shader cache', risk: 'safe',
      description: 'Graphics shader cache recreated by games and applications.',
      roots: existing([path.join(local, 'D3DSCache')]),
    },
    {
      id: 'crash-dumps', name: 'Crash dumps', risk: 'review',
      description: 'Application and Windows crash dumps used for diagnostics.',
      roots: existing([path.join(local, 'CrashDumps'), path.join(windows, 'Minidump')]),
    },
    {
      id: 'error-reports', name: 'Windows error reports', risk: 'safe',
      description: 'Queued and archived Windows Error Reporting data.',
      roots: existing([path.join(local, 'Microsoft', 'Windows', 'WER'), path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'WER')]),
    },
    {
      id: 'browser-cache', name: 'Browser cache', risk: 'safe',
      description: 'Cached web assets from Chrome, Edge and Firefox profiles.',
      roots: existing([
        path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
        path.join(local, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
        ...firefoxCacheRoots(roaming),
      ]),
    },
  ];
}

async function collectChildren(definition) {
  const results = [];
  for (const root of definition.roots) {
    let names = [];
    try { names = await fsp.readdir(root); } catch { continue; }
    for (const name of names) {
      if (definition.include && !definition.include(name)) continue;
      results.push(path.join(root, name));
    }
  }
  return results;
}

async function scanCleaner(options = {}) {
  const categories = [];
  for (const definition of cleanupDefinitions()) {
    const targets = await collectChildren(definition);
    let sizeBytes = 0;
    let files = 0;
    for (const target of targets) {
      const size = await sizeOf(target, 100000);
      sizeBytes += size.bytes;
      files += size.files;
    }
    categories.push({
      id: definition.id,
      name: definition.name,
      risk: definition.risk,
      description: definition.description,
      requiresAdmin: Boolean(definition.requiresAdmin),
      sizeBytes,
      files,
      available: definition.roots.length > 0,
    });
  }
  if (options.log !== false) await logActivity('Scan', `Cleaner scan completed (${categories.length} categories)`);
  return categories;
}

async function runCleanup(categoryIds) {
  const requested = new Set(Array.isArray(categoryIds) ? categoryIds : []);
  const results = [];
  let totalBytes = 0;
  for (const definition of cleanupDefinitions()) {
    if (!requested.has(definition.id)) continue;
    const targets = await collectChildren(definition);
    let moved = 0;
    let bytes = 0;
    const errors = [];
    for (const target of targets) {
      try {
        const item = await trashPath(target, definition.name, { allowProtected: true });
        moved += 1;
        bytes += item.sizeBytes;
      } catch (error) {
        errors.push({ path: target, message: error.message });
      }
    }
    totalBytes += bytes;
    results.push({ id: definition.id, moved, sizeBytes: bytes, errors });
  }
  await logActivity('Trash', 'Moved cleanup data to trash', totalBytes);
  return { sizeBytes: totalBytes, results };
}

module.exports = { scanCleaner, runCleanup };
