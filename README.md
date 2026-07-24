# Free Win64 PC Cleaner

A local-only Windows 10/11 x64 file manager, storage analyzer, and cleanup tool.

## What it uses

- Frontend: React, TanStack Start, Tailwind CSS
- Backend: Node.js and Express
- Local database: SQLite via Node's built-in `node:sqlite`, or MySQL via `mysql2`
- Scope: local machine only, no account, no cloud sync, no telemetry

## Requirements

- Bun
- Node.js 22+ x64
- Windows 10 or Windows 11 x64

Node is still required at runtime because the backend uses Node-specific APIs.
Bun is used for dependency installation and the main project launcher.

## Install and start

From the project root:

```powershell
bun install
bun run start
```

On Windows you can also double-click:

```text
start-windows.bat
```

That launcher checks Bun and Node, installs dependencies with Bun if needed, then starts the app.

## Database selection

Create a `.env` file in the project root:

```env
DB_CLIENT=sqlite
```

Or switch to MySQL:

```env
DB_CLIENT=mysql
DATABASE_URL=mysql://root:password@127.0.0.1:3306/free_win64_pc_cleaner
```

Optional MySQL variables are also supported:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=free_win64_pc_cleaner
```

## Local data location

When SQLite is selected, app data is stored outside the repo:

```text
%LOCALAPPDATA%\FreeWin64PCCleaner\
├── data\cleaner.db
└── trash\
```

## Useful commands

```powershell
bun run backend
bun run frontend
```

## Features

- Drive free-space reporting
- Installed application inventory and official uninstaller launch
- Startup registry enable/disable with local persistence
- File browser, copy, move, and folder creation
- Trash for manual delete and cleanup operations
- Cleanup scans for temp files, caches, crash dumps, and browser data
- Large-file, duplicate-file, and storage-usage scans
- Local settings with protected paths

## Notes

- The app binds to `127.0.0.1` only.
- Some cleanup actions need Administrator privileges.
- If you switch database backends, keep the `.env` file in sync with the database you actually want to use.

