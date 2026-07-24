export type Health = {
  ok: boolean;
  name: string;
  version: string;
  platform: string;
  architecture: string;
  windowsSupported: boolean;
  database: string;
  authentication: false;
  localOnly: true;
};

export type Drive = {
  id: string;
  label: string;
  mount: string;
  fs: string;
  totalGB: number;
  usedGB: number;
  freeGB: number;
};

export type CleanupCategory = {
  id: string;
  name: string;
  risk: 'safe' | 'review' | 'caution';
  description: string;
  requiresAdmin?: boolean;
  sizeBytes: number;
  files: number;
  available: boolean;
};

export type QuarantineItem = {
  id: string;
  originalPath: string;
  sizeBytes: number;
  category: string;
  deletedAt: string;
  expiresAt: string;
  isDirectory: boolean;
};

export type Application = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  sizeMB: number;
  installed: string;
  source: 'desktop' | 'store';
  canUninstall: boolean;
};

export type StartupEntry = {
  id: string;
  name: string;
  publisher: string;
  path: string;
  enabled: boolean;
  impact: 'low' | 'medium' | 'high';
  source: 'registry' | 'folder' | 'task';
};

export type FileEntry = {
  name: string;
  path: string;
  kind: string;
  isDirectory: boolean;
  sizeBytes: number | null;
  modified: string;
};

export type DirectoryListing = { path: string; parent: string; entries: FileEntry[] };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Backend request failed (${response.status})`);
  return payload as T;
}

export const api = {
  health: () => request<Health>('/api/health'),
  overview: () => request<{ drives: Drive[]; cleanupCategories: CleanupCategory[]; quarantine: QuarantineItem[]; activity: Array<{ id: number; action: string; detail: string; freedBytes: number | null; createdAt: string }> }>('/api/overview'),
  drives: () => request<Drive[]>('/api/drives'),
  applications: () => request<Application[]>('/api/applications'),
  uninstall: (id: string) => request<{ launched: boolean; name: string }>(`/api/applications/${id}/uninstall`, { method: 'POST' }),
  startup: () => request<StartupEntry[]>('/api/startup'),
  toggleStartup: (id: string, enabled: boolean) => request<{ id: string; enabled: boolean }>(`/api/startup/${id}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) }),
  files: (path?: string) => request<DirectoryListing>(`/api/files${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  createFolder: (parentPath: string, name: string) => request<{ path: string }>('/api/files/folder', { method: 'POST', body: JSON.stringify({ parentPath, name }) }),
  quarantineFile: (path: string) => request<QuarantineItem>('/api/files', { method: 'DELETE', body: JSON.stringify({ path }) }),
  cleanerScan: () => request<CleanupCategory[]>('/api/cleaner/scan'),
  clean: (categoryIds: string[]) => request<{ sizeBytes: number; results: unknown[] }>('/api/cleaner/run', { method: 'POST', body: JSON.stringify({ categoryIds }) }),
  quarantine: () => request<QuarantineItem[]>('/api/quarantine'),
  restore: (id: string) => request(`/api/quarantine/${id}/restore`, { method: 'POST' }),
  purge: (id: string) => request(`/api/quarantine/${id}`, { method: 'DELETE' }),
  settings: () => request<Record<string, unknown>>('/api/settings'),
  saveSettings: (settings: Record<string, unknown>) => request<Record<string, unknown>>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  largeFiles: (root: string, minMB: number) => request<{ root: string; files: Array<{ path: string; name: string; directory: string; kind: string; sizeBytes: number; modified: string }> }>('/api/scans/large-files', { method: 'POST', body: JSON.stringify({ root, minMB }) }),
  duplicates: (root: string, minMB = 1) => request<{ root: string; groups: Array<{ hash: string; sizeBytes: number; copies: Array<{ path: string; modified: string }> }> }>('/api/scans/duplicates', { method: 'POST', body: JSON.stringify({ root, minMB }) }),
  storage: (root: string) => request<{ root: string; scannedFiles: number; usageByType: Array<{ type: string; sizeBytes: number }>; largestFolders: Array<{ path: string; sizeBytes: number; items: number }> }>('/api/scans/storage', { method: 'POST', body: JSON.stringify({ root }) }),
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 10 || unit < 2 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
