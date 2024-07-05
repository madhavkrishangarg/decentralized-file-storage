const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('landing.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('start-node', (event, knownPeer) => {
  pythonProcess = spawn('python3', ['node.py'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  pythonProcess.stdout.on('data', (data) => {
    mainWindow.webContents.send('node-output', data.toString());
  });

  pythonProcess.stderr.on('data', (data) => {
    mainWindow.webContents.send('node-error', data.toString());
  });

  if (knownPeer) {
    pythonProcess.stdin.write(`${knownPeer}\n`);
  } else {
    pythonProcess.stdin.write('\n');
  }
});

ipcMain.on('send-command', (event, command) => {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.stdin.write(`${command}\n`);
  }
});

app.on('before-quit', () => {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill();
  }
});