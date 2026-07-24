# Free Win64 PC Cleaner

A local-only Windows 10/11 x64 file manager, storage analyzer and PC cleanup application.

## Local architecture

- Frontend: React, TanStack Start and Tailwind CSS.
- Backend: Node.js and Express, bound only to `127.0.0.1:3210`.
- Database: `better-sqlite3` with WAL mode.
- Authentication: none. The API is intentionally accessible only from the local computer.
- System integration: PowerShell and native Node.js filesystem APIs.
- Safety: cleanup and manual deletion move files to the application quarantine first.

Application data is stored outside the repository:

```text
%LOCALAPPDATA%\FreeWin64PCCleaner\
├── data\cleaner.db
└── quarantine\
```

## Windows 10/11 x64 installation

Install a current Node.js LTS x64 release. Then clone or download this repository and double-click:

```text
start-windows.bat
```

The launcher installs dependencies on the first run, starts the local API and frontend, then opens:

```text
http://127.0.0.1:3000
```

No account or password is requested.

## Command-line start

```powershell
npm install
npm start
```

Separate processes are also available:

```powershell
npm run backend
npm run frontend
```

## Implemented backend capabilities

- Local API health and compatibility status.
- Windows drive capacity and free-space discovery.
- Installed desktop application inventory and official uninstaller launch.
- Startup registry inventory.
- Real directory browsing and folder creation.
- File copy, move and quarantine operations.
- Cleanup scans for temporary files, thumbnail cache, DirectX cache, crash dumps, Windows error reports and browser caches.
- SQLite-backed quarantine restore and permanent purge.
- Large-file, duplicate-file and storage-usage scans.
- SQLite-backed settings, protected paths and activity history.

Some Windows locations require starting the terminal as Administrator. The backend reports access errors per item instead of silently deleting inaccessible data.
