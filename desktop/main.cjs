const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

let backendProcess;
let webProcess;
let mainWindow;
const packaged = app.isPackaged;
const appRoot = packaged ? app.getAppPath() : path.resolve(__dirname, '..');
const backendDir = packaged ? path.join(process.resourcesPath, 'media-backend') : path.join(appRoot, 'media-backend');
const nextCli = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

function portReady(port, host = '127.0.0.1', timeout = 90000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const socket = net.createConnection({ port, host });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeout) reject(new Error(`Timed out waiting for port ${port}.`));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function spawnNext() {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', MEDIA_BACKEND_URL: 'http://127.0.0.1:8000', PORT: '3000', HOSTNAME: '127.0.0.1' };
  // Electron's bundled Node runtime starts Next, so Node.js does not need to be installed for the packaged app.
  webProcess = spawn(process.execPath, [nextCli, 'start', '-p', '3000', '-H', '127.0.0.1'], {
    cwd: appRoot, env, stdio: 'ignore', windowsHide: true
  });
  webProcess.on('error', err => console.error('Could not start CleanDrop web service:', err));
}

function spawnBackend() {
  const mainPy = path.join(backendDir, 'main.py');
  if (!fs.existsSync(mainPy)) throw new Error(`Backend file not found: ${mainPy}`);
  // Python and requirements must be installed on this PC. Prefer a project venv when running from source.
  const venvPython = process.platform === 'win32' ? path.join(backendDir, '.venv', 'Scripts', 'python.exe') : path.join(backendDir, '.venv', 'bin', 'python');
  const hasVenv = fs.existsSync(venvPython);
  const python = hasVenv ? venvPython : (process.platform === 'win32' ? 'py' : 'python3');
  const args = hasVenv ? [mainPy] : (process.platform === 'win32' ? ['-3', mainPy] : [mainPy]);
  backendProcess = spawn(python, args, { cwd: backendDir, env: { ...process.env, HOST: '127.0.0.1', PORT: '8000' }, stdio: 'ignore', windowsHide: true });
  backendProcess.on('error', err => console.error('Could not start Python backend:', err));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180, height: 820, minWidth: 800, minHeight: 600,
    title: 'CleanDrop', backgroundColor: '#101114',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  try {
    spawnBackend();
    spawnNext();
    await portReady(8000, '127.0.0.1', 90000);
    await portReady(3000, '127.0.0.1', 90000);
    await mainWindow.loadURL('http://127.0.0.1:3000');
  } catch (err) {
    await dialog.showMessageBox(mainWindow, {
      type: 'error', title: 'CleanDrop could not start',
      message: 'CleanDrop could not start its local services.',
      detail: `${err.message}\n\nCheck that Python is installed and that media-backend requirements are installed. See README-DESKTOP.md for setup steps.`
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  for (const child of [backendProcess, webProcess]) {
    if (child && !child.killed) child.kill();
  }
});
