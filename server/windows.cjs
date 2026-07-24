const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { db, logActivity } = require('./database.cjs');
const execFileAsync = promisify(execFile);

function ensureWindows() {
  if (process.platform !== 'win32') {
    const error = new Error('This operation is available only on Windows 10/11.');
    error.status = 501;
    throw error;
  }
}

async function powershell(script, timeout = 30000) {
  ensureWindows();
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
  );
  return stdout.trim();
}

async function powershellJson(script, timeout) {
  const output = await powershell(`$ErrorActionPreference='Stop'; ${script} | ConvertTo-Json -Depth 6 -Compress`, timeout);
  if (!output) return [];
  const value = JSON.parse(output);
  return Array.isArray(value) ? value : [value];
}

function encodePowerShell(value) {
  return Buffer.from(String(value), 'utf16le').toString('base64');
}

async function getDrives() {
  const rows = await powershellJson(`
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
      Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace
  `);
  return rows.map((row) => ({
    id: String(row.DeviceID || '').replace(':', '').toLowerCase(),
    label: row.VolumeName || (row.DeviceID === 'C:' ? 'System' : 'Local Disk'),
    mount: `${row.DeviceID}\\`,
    fs: row.FileSystem || 'Unknown',
    totalGB: Number(row.Size || 0) / 1073741824,
    usedGB: (Number(row.Size || 0) - Number(row.FreeSpace || 0)) / 1073741824,
    freeGB: Number(row.FreeSpace || 0) / 1073741824,
  }));
}

async function getApplications() {
  const rows = await powershellJson(`
    $paths = @(
      'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
    );
    Get-ItemProperty $paths -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName } |
      Select-Object DisplayName, Publisher, DisplayVersion, EstimatedSize, InstallDate, UninstallString, QuietUninstallString, PSPath
  `, 45000);
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.DisplayName}|${row.DisplayVersion}|${row.Publisher}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((row) => ({
    id: crypto.createHash('sha1').update(String(row.PSPath || row.DisplayName)).digest('hex').slice(0, 16),
    name: row.DisplayName,
    publisher: row.Publisher || 'Unknown',
    version: row.DisplayVersion || '—',
    sizeMB: Number(row.EstimatedSize || 0) / 1024,
    installed: row.InstallDate ? String(row.InstallDate).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') : '—',
    source: 'desktop',
    uninstallString: row.QuietUninstallString || row.UninstallString || null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

async function launchUninstaller(id) {
  const applications = await getApplications();
  const app = applications.find((item) => item.id === id);
  if (!app || !app.uninstallString) {
    const error = new Error('No official uninstaller is registered for this application.');
    error.status = 404;
    throw error;
  }
  const encoded = encodePowerShell(app.uninstallString);
  await powershell(`
    $command = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'));
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/s','/c',('start "" ' + $command)
  `);
  return { launched: true, name: app.name };
}

async function getActiveStartupEntries() {
  const rows = await powershellJson(`
    $items = @();
    foreach ($root in @(
      @{ Path='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Scope='Current user' },
      @{ Path='HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; Scope='All users' }
    )) {
      if (Test-Path $root.Path) {
        $key = Get-Item $root.Path;
        foreach ($name in $key.GetValueNames()) {
          $items += [PSCustomObject]@{ Name=$name; Command=$key.GetValue($name); RegistryPath=$root.Path; Scope=$root.Scope }
        }
      }
    }
    $items
  `);
  return rows.map((row) => ({
    id: crypto.createHash('sha1').update(`${row.RegistryPath}|${row.Name}`).digest('hex').slice(0, 16),
    name: row.Name,
    publisher: row.Scope,
    path: row.Command,
    enabled: true,
    impact: 'medium',
    source: 'registry',
    registryPath: row.RegistryPath,
    valueName: row.Name,
  }));
}

async function getStartupEntries() {
  const active = await getActiveStartupEntries();
  const disabled = db.prepare(`
    SELECT id, name, command AS path, registry_path AS registryPath, scope AS publisher
    FROM disabled_startup ORDER BY name
  `).all().map((row) => ({
    ...row,
    valueName: row.name,
    enabled: false,
    impact: 'medium',
    source: 'registry',
  }));
  return [...active, ...disabled].sort((a, b) => a.name.localeCompare(b.name));
}

async function toggleStartup(id, enabled) {
  if (enabled) {
    const item = db.prepare('SELECT * FROM disabled_startup WHERE id = ?').get(id);
    if (!item) {
      const error = new Error('Disabled startup entry not found.');
      error.status = 404;
      throw error;
    }
    const registryPath = encodePowerShell(item.registry_path);
    const name = encodePowerShell(item.name);
    const command = encodePowerShell(item.command);
    await powershell(`
      $path=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${registryPath}'));
      $name=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${name}'));
      $command=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${command}'));
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null };
      New-ItemProperty -Path $path -Name $name -Value $command -PropertyType String -Force | Out-Null
    `);
    db.prepare('DELETE FROM disabled_startup WHERE id = ?').run(id);
    logActivity('Startup', `Enabled ${item.name}`);
    return { id, enabled: true };
  }

  const active = await getActiveStartupEntries();
  const item = active.find((entry) => entry.id === id);
  if (!item) {
    const error = new Error('Enabled startup entry not found.');
    error.status = 404;
    throw error;
  }
  const registryPath = encodePowerShell(item.registryPath);
  const name = encodePowerShell(item.valueName);
  await powershell(`
    $path=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${registryPath}'));
    $name=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${name}'));
    Remove-ItemProperty -Path $path -Name $name -ErrorAction Stop
  `);
  db.prepare(`
    INSERT OR REPLACE INTO disabled_startup (id, name, command, registry_path, scope)
    VALUES (?, ?, ?, ?, ?)
  `).run(item.id, item.name, item.path, item.registryPath, item.publisher);
  logActivity('Startup', `Disabled ${item.name}`);
  return { id, enabled: false };
}

module.exports = { getDrives, getApplications, launchUninstaller, getStartupEntries, toggleStartup, powershell };
