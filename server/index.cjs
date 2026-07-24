const express = require('express');
const os = require('node:os');
const path = require('node:path');
const config = require('./config.cjs');
const { db, getSettings, updateSettings, logActivity } = require('./database.cjs');
const { getDrives, getApplications, launchUninstaller, getStartupEntries, toggleStartup } = require('./windows.cjs');
const {
  listDirectory, createFolder, copyPath, movePath, quarantinePath,
  listQuarantine, restoreQuarantine, purgeQuarantine,
  walkFiles, findLargeFiles, findDuplicates, sizeOf,
} = require('./filesystem.cjs');
const { scanCleaner, runCleanup } = require('./cleaner.cjs');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'Free Win64 PC Cleaner',
    version: '0.2.0',
    platform: process.platform,
    architecture: process.arch,
    windowsSupported: process.platform === 'win32' && process.arch === 'x64',
    database: config.databasePath,
    authentication: false,
    localOnly: true,
  });
});

app.get('/api/drives', asyncRoute(async (req, res) => {
  res.json(await getDrives());
}));

app.get('/api/applications', asyncRoute(async (req, res) => {
  const applications = await getApplications();
  res.json(applications.map(({ uninstallString, ...application }) => ({
    ...application,
    canUninstall: Boolean(uninstallString),
  })));
}));

app.post('/api/applications/:id/uninstall', asyncRoute(async (req, res) => {
  const result = await launchUninstaller(req.params.id);
  logActivity('Uninstall', `Launched official uninstaller for ${result.name}`);
  res.json(result);
}));

app.get('/api/startup', asyncRoute(async (req, res) => {
  res.json(await getStartupEntries());
}));

app.post('/api/startup/:id/toggle', asyncRoute(async (req, res) => {
  res.json(await toggleStartup(req.params.id, Boolean(req.body.enabled)));
}));

app.get('/api/files', asyncRoute(async (req, res) => {
  res.json(await listDirectory(req.query.path || os.homedir()));
}));

app.post('/api/files/folder', asyncRoute(async (req, res) => {
  res.status(201).json(await createFolder(req.body.parentPath, req.body.name));
}));

app.post('/api/files/copy', asyncRoute(async (req, res) => {
  res.json(await copyPath(req.body.sourcePath, req.body.destinationPath));
}));

app.post('/api/files/move', asyncRoute(async (req, res) => {
  res.json(await movePath(req.body.sourcePath, req.body.destinationPath));
}));

app.delete('/api/files', asyncRoute(async (req, res) => {
  const item = await quarantinePath(req.body.path, req.body.category || 'Manual file operation');
  logActivity('Quarantine', item.originalPath, item.sizeBytes);
  res.json(item);
}));

app.get('/api/cleaner/scan', asyncRoute(async (req, res) => {
  res.json(await scanCleaner());
}));

app.post('/api/cleaner/run', asyncRoute(async (req, res) => {
  res.json(await runCleanup(req.body.categoryIds));
}));

app.get('/api/quarantine', (req, res) => {
  res.json(listQuarantine());
});

app.post('/api/quarantine/:id/restore', asyncRoute(async (req, res) => {
  res.json(await restoreQuarantine(req.params.id));
}));

app.delete('/api/quarantine/:id', asyncRoute(async (req, res) => {
  res.json(await purgeQuarantine(req.params.id));
}));

app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.put('/api/settings', (req, res) => {
  res.json(updateSettings(req.body || {}));
});

app.get('/api/activity', (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || 50), 500));
  const rows = db.prepare(`
    SELECT id, action, detail, freed_bytes AS freedBytes, created_at AS createdAt
    FROM activity ORDER BY id DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

app.post('/api/scans/large-files', asyncRoute(async (req, res) => {
  const root = req.body.root || os.homedir();
  const minBytes = Math.max(0, Number(req.body.minMB || 1024) * 1024 * 1024);
  const files = await findLargeFiles(root, minBytes, Number(req.body.limit || 500));
  logActivity('Scan', `Large-file scan: ${root}`);
  res.json({ root: path.resolve(root), files });
}));

app.post('/api/scans/duplicates', asyncRoute(async (req, res) => {
  const root = req.body.root || os.homedir();
  const minBytes = Math.max(1, Number(req.body.minMB || 1) * 1024 * 1024);
  const groups = await findDuplicates(root, minBytes);
  logActivity('Scan', `Duplicate scan: ${root}`);
  res.json({ root: path.resolve(root), groups });
}));

app.post('/api/scans/storage', asyncRoute(async (req, res) => {
  const root = req.body.root || os.homedir();
  const files = await walkFiles(root, { maxFiles: getSettings().scanMaxFiles });
  const types = new Map();
  for (const file of files) {
    const ext = path.extname(file.name).slice(1).toLowerCase();
    const type = ['mp4','mkv','mov','avi','webm'].includes(ext) ? 'Video'
      : ['jpg','jpeg','png','gif','webp','bmp'].includes(ext) ? 'Images'
      : ['zip','7z','rar','tar','gz','iso'].includes(ext) ? 'Archives'
      : ['exe','msi','appx'].includes(ext) ? 'Installers'
      : ['doc','docx','pdf','txt','xls','xlsx','ppt','pptx'].includes(ext) ? 'Documents'
      : 'Other';
    types.set(type, (types.get(type) || 0) + file.sizeBytes);
  }
  let children = [];
  try {
    const names = require('node:fs').readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).slice(0, 40);
    children = await Promise.all(names.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      const size = await sizeOf(fullPath, 100000);
      return { path: fullPath, sizeBytes: size.bytes, items: size.files };
    }));
  } catch {}
  children.sort((a, b) => b.sizeBytes - a.sizeBytes);
  logActivity('Scan', `Storage scan: ${root}`);
  res.json({
    root: path.resolve(root),
    scannedFiles: files.length,
    usageByType: [...types.entries()].map(([type, sizeBytes]) => ({ type, sizeBytes })),
    largestFolders: children.slice(0, 20),
  });
}));

app.get('/api/overview', asyncRoute(async (req, res) => {
  const [drives, cleanupCategories] = await Promise.all([getDrives(), scanCleaner()]);
  const activity = db.prepare(`
    SELECT id, action, detail, freed_bytes AS freedBytes, created_at AS createdAt
    FROM activity ORDER BY id DESC LIMIT 10
  `).all();
  res.json({ drives, cleanupCategories, quarantine: listQuarantine(), activity });
}));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((error, req, res, next) => {
  const status = Number(error.status || (error.code === 'ENOENT' ? 404 : 500));
  console.error(`[${new Date().toISOString()}]`, error);
  res.status(status).json({
    error: error.message || 'Unexpected backend error',
    code: error.code || null,
  });
});

const server = app.listen(config.port, config.host, () => {
  console.log(`Free Win64 PC Cleaner backend: http://${config.host}:${config.port}`);
  console.log(`SQLite database: ${config.databasePath}`);
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    console.warn('Warning: system operations require Windows 10/11 x64.');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
