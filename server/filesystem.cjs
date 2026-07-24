const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const config = require('./config.cjs');
const { db, getSettings, logActivity } = require('./database.cjs');

function normalizePath(value) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error('A non-empty path is required.');
    error.status = 400;
    throw error;
  }
  const expanded = value.replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`);
  return path.resolve(expanded);
}

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertNotProtected(target) {
  const settings = getSettings();
  const normalized = path.resolve(target).toLowerCase();
  for (const protectedPath of settings.protectedPaths || []) {
    const protectedNormalized = path.resolve(protectedPath).toLowerCase();
    if (normalized === protectedNormalized || isInside(normalized, protectedNormalized)) {
      const error = new Error(`Protected path cannot be modified: ${target}`);
      error.status = 403;
      throw error;
    }
  }
}

async function sizeOf(target, limit = Number.MAX_SAFE_INTEGER) {
  let total = 0;
  let files = 0;
  const stack = [target];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try { stat = await fsp.lstat(current); } catch { continue; }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      let entries = [];
      try { entries = await fsp.readdir(current); } catch { continue; }
      for (const entry of entries) stack.push(path.join(current, entry));
    } else if (stat.isFile()) {
      total += stat.size;
      files += 1;
      if (files >= limit) break;
    }
  }
  return { bytes: total, files };
}

function kindFor(name, isDirectory) {
  if (isDirectory) return 'folder';
  const ext = path.extname(name).slice(1).toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'flac', 'wav', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (['zip', '7z', 'rar', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'cs'].includes(ext)) return 'code';
  return ext || 'file';
}

async function listDirectory(inputPath) {
  const target = normalizePath(inputPath || os.homedir());
  const stat = await fsp.stat(target);
  if (!stat.isDirectory()) {
    const error = new Error('The requested path is not a directory.');
    error.status = 400;
    throw error;
  }
  const dirents = await fsp.readdir(target, { withFileTypes: true });
  const entries = await Promise.all(dirents.slice(0, 2000).map(async (entry) => {
    const fullPath = path.join(target, entry.name);
    let itemStat;
    try { itemStat = await fsp.stat(fullPath); } catch { return null; }
    return {
      name: entry.name,
      path: fullPath,
      kind: kindFor(entry.name, entry.isDirectory()),
      isDirectory: entry.isDirectory(),
      sizeBytes: entry.isFile() ? itemStat.size : null,
      modified: itemStat.mtime.toISOString(),
    };
  }));
  return { path: target, parent: path.dirname(target), entries: entries.filter(Boolean) };
}

async function createFolder(parentPath, name) {
  const parent = normalizePath(parentPath);
  if (typeof name !== 'string' || !name.trim() || /[<>:"/\\|?*]/.test(name)) {
    const error = new Error('Invalid folder name.');
    error.status = 400;
    throw error;
  }
  assertNotProtected(parent);
  const target = path.join(parent, name.trim());
  await fsp.mkdir(target, { recursive: false });
  logActivity('Folder', `Created ${target}`);
  return { path: target };
}

async function copyPath(sourcePath, destinationPath) {
  const source = normalizePath(sourcePath);
  const destination = normalizePath(destinationPath);
  assertNotProtected(destination);
  await fsp.cp(source, destination, { recursive: true, errorOnExist: true });
  logActivity('Copy', `${source} → ${destination}`);
  return { source, destination };
}

async function movePath(sourcePath, destinationPath) {
  const source = normalizePath(sourcePath);
  const destination = normalizePath(destinationPath);
  assertNotProtected(source);
  assertNotProtected(destination);
  try {
    await fsp.rename(source, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fsp.cp(source, destination, { recursive: true, errorOnExist: true });
    await fsp.rm(source, { recursive: true, force: false });
  }
  logActivity('Move', `${source} → ${destination}`);
  return { source, destination };
}

async function quarantinePath(inputPath, category = 'Manual', options = {}) {
  const originalPath = normalizePath(inputPath);
  if (!options.allowProtected) assertNotProtected(originalPath);
  const stat = await fsp.lstat(originalPath);
  const id = crypto.randomUUID();
  const storedPath = path.join(config.quarantineRoot, id);
  const { bytes } = await sizeOf(originalPath);
  try {
    await fsp.rename(originalPath, storedPath);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fsp.cp(originalPath, storedPath, { recursive: true, errorOnExist: true });
    await fsp.rm(originalPath, { recursive: true, force: false });
  }
  const retentionDays = Number(getSettings().quarantineRetentionDays || 30);
  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt.getTime() + retentionDays * 86400000);
  db.prepare(`
    INSERT INTO quarantine_items
      (id, original_path, stored_path, size_bytes, category, deleted_at, expires_at, is_directory)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, originalPath, storedPath, bytes, category, deletedAt.toISOString(), expiresAt.toISOString(), stat.isDirectory() ? 1 : 0);
  return { id, originalPath, storedPath, sizeBytes: bytes, category };
}

function listQuarantine() {
  return db.prepare(`
    SELECT id, original_path AS originalPath, size_bytes AS sizeBytes, category,
           deleted_at AS deletedAt, expires_at AS expiresAt, is_directory AS isDirectory
    FROM quarantine_items ORDER BY deleted_at DESC
  `).all().map((item) => ({ ...item, isDirectory: Boolean(item.isDirectory) }));
}

async function restoreQuarantine(id) {
  const item = db.prepare('SELECT * FROM quarantine_items WHERE id = ?').get(id);
  if (!item) {
    const error = new Error('Quarantine item not found.');
    error.status = 404;
    throw error;
  }
  await fsp.mkdir(path.dirname(item.original_path), { recursive: true });
  if (fs.existsSync(item.original_path)) {
    const error = new Error('The original location already contains an item with the same name.');
    error.status = 409;
    throw error;
  }
  try {
    await fsp.rename(item.stored_path, item.original_path);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fsp.cp(item.stored_path, item.original_path, { recursive: true, errorOnExist: true });
    await fsp.rm(item.stored_path, { recursive: true, force: true });
  }
  db.prepare('DELETE FROM quarantine_items WHERE id = ?').run(id);
  logActivity('Restore', item.original_path);
  return { restored: true, path: item.original_path };
}

async function purgeQuarantine(id) {
  const item = db.prepare('SELECT * FROM quarantine_items WHERE id = ?').get(id);
  if (!item) {
    const error = new Error('Quarantine item not found.');
    error.status = 404;
    throw error;
  }
  await fsp.rm(item.stored_path, { recursive: true, force: true });
  db.prepare('DELETE FROM quarantine_items WHERE id = ?').run(id);
  logActivity('Purge', item.original_path, item.size_bytes);
  return { purged: true, sizeBytes: item.size_bytes };
}

async function walkFiles(rootPath, options = {}) {
  const root = normalizePath(rootPath);
  const maxFiles = Math.max(1, Math.min(Number(options.maxFiles || 50000), 250000));
  const minBytes = Math.max(0, Number(options.minBytes || 0));
  const files = [];
  const stack = [root];
  const excludedNames = new Set(['$Recycle.Bin', 'System Volume Information', 'node_modules', '.git']);
  while (stack.length && files.length < maxFiles) {
    const current = stack.pop();
    let entries;
    try { entries = await fsp.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (excludedNames.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile()) {
        try {
          const stat = await fsp.stat(fullPath);
          if (stat.size >= minBytes) files.push({ path: fullPath, name: entry.name, sizeBytes: stat.size, modified: stat.mtime.toISOString() });
        } catch {}
      }
    }
  }
  return files;
}

async function findLargeFiles(rootPath, minBytes = 1024 * 1024 * 1024, limit = 500) {
  const files = await walkFiles(rootPath, { minBytes, maxFiles: getSettings().scanMaxFiles });
  return files.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, limit).map((file) => ({
    ...file,
    directory: path.dirname(file.path),
    kind: kindFor(file.name, false),
  }));
}

async function hashFile(filePath, algorithm = 'sha256') {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function findDuplicates(rootPath, minBytes = 1024 * 1024) {
  const files = await walkFiles(rootPath, { minBytes, maxFiles: getSettings().scanMaxFiles });
  const bySize = new Map();
  for (const file of files) {
    const group = bySize.get(file.sizeBytes) || [];
    group.push(file);
    bySize.set(file.sizeBytes, group);
  }
  const groups = [];
  for (const candidates of bySize.values()) {
    if (candidates.length < 2) continue;
    const byHash = new Map();
    for (const file of candidates) {
      let hash;
      try { hash = await hashFile(file.path); } catch { continue; }
      const group = byHash.get(hash) || [];
      group.push(file);
      byHash.set(hash, group);
    }
    for (const [hash, copies] of byHash.entries()) {
      if (copies.length > 1) groups.push({ hash, sizeBytes: copies[0].sizeBytes, copies });
    }
  }
  return groups.sort((a, b) => (b.sizeBytes * (b.copies.length - 1)) - (a.sizeBytes * (a.copies.length - 1))).slice(0, 200);
}

module.exports = {
  normalizePath,
  sizeOf,
  listDirectory,
  createFolder,
  copyPath,
  movePath,
  quarantinePath,
  listQuarantine,
  restoreQuarantine,
  purgeQuarantine,
  walkFiles,
  findLargeFiles,
  findDuplicates,
};
