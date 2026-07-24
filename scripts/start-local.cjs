const { spawn } = require('node:child_process');
const { resolve } = require('node:path');
require('../server/env.cjs');

const rootDir = resolve(__dirname, '..');
const children = [];
let stopping = false;

function forwardStream(stream, target) {
  if (!stream || !target) return;
  stream.on('data', (chunk) => {
    if (target.writable) target.write(chunk);
  });
}

function run(command, args, label) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    windowsHide: true,
  });
  children.push(child);
  forwardStream(child.stdout, process.stdout);
  forwardStream(child.stderr, process.stderr);
  child.on('error', (error) => {
    if (!stopping) {
      console.error(`${label} failed to start: ${error.message}`);
      shutdown(1);
    }
  });
  child.on('exit', (code) => {
    if (!stopping && code !== 0) {
      console.error(`${label} stopped with exit code ${code}.`);
      shutdown(code || 1);
    }
  });
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300).unref();
}

run('node', [resolve(rootDir, 'server', 'index.cjs')], 'Backend');
run('node', [resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'dev', '--host', '127.0.0.1', '--port', '3000'], 'Frontend');

if (process.platform === 'win32' && process.env.PC_CLEANER_NO_BROWSER !== '1') {
  setTimeout(() => {
    spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', 'http://127.0.0.1:3000'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  }, 2500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
