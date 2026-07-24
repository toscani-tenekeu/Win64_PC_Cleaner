const { spawn } = require('node:child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let stopping = false;

function run(script, label) {
  const child = spawn(npm, ['run', script], {
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
    windowsHide: false,
  });
  children.push(child);
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

run('backend', 'Backend');
run('frontend', 'Frontend');

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
