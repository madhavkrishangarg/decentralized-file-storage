const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const axios = require('axios');

let mainWindow;
let pythonProcess;
let ws;
let wsRetryCount = 0;
const MAX_RETRY = 5;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  mainWindow.loadFile('landing.html');
}

function startPythonServer() {
  pythonProcess = spawn('python3', [path.join(__dirname, 'python', 'runner.py')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

function setupWebSocket() {
  ws = new WebSocket('ws://localhost:8080/ws');

  ws.on('open', function open() {
    console.log('Connected to WebSocket server');
    wsRetryCount = 0;
    mainWindow.webContents.send('ws-status', { connected: true });
  });

  ws.on('message', function incoming(data) {
    const message = JSON.parse(data);
    if (message.type === 'chat') {
      mainWindow.webContents.send('chat-message', message);
    }
  });

  ws.on('close', function close() {
    console.log('Disconnected from WebSocket server');
    mainWindow.webContents.send('ws-status', { connected: false });
    retryWebSocketConnection();
  });

  ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
    retryWebSocketConnection();
  });
}

function retryWebSocketConnection() {
  if (wsRetryCount < MAX_RETRY) {
    wsRetryCount++;
    console.log(`Retrying WebSocket connection... Attempt ${wsRetryCount}`);
    setTimeout(setupWebSocket, 5000);
  } else {
    console.error('Max retry attempts reached. WebSocket connection failed.');
    mainWindow.webContents.send('ws-status', { connected: false, maxRetryReached: true });
  }
}

app.whenReady().then(() => {
  createWindow();
  startPythonServer();
  
  setTimeout(() => {
    setupWebSocket();
  }, 2000);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (pythonProcess) {
    await axios.post('http://localhost:8080/shutdown').catch(console.error);
    pythonProcess.kill();
  }
  if (ws) ws.close();
});

ipcMain.handle('start-node', async (event, knownPeer) => {
  try {
    const response = await axios.post('http://localhost:8080/initialize', { 
      known_peer: knownPeer ? { ip: knownPeer.split(':')[0], port: parseInt(knownPeer.split(':')[1]) } : null 
    });
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('send-chat', async (event, message) => {
  try {
    const response = await axios.post('http://localhost:8080/chat', { message });
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('distribute-file', async (event, filePath) => {
  try {
    const response = await axios.post('http://localhost:8080/distribute', { file_path: filePath });
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('retrieve-file', async (event, fileId, outputPath) => {
  try {
    const response = await axios.post('http://localhost:8080/retrieve', { file_id: fileId, output_path: outputPath });
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('delete-file', async (event, fileId) => {
  try {
    const response = await axios.post('http://localhost:8080/delete', { file_id: fileId });
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.on('load-dashboard', (event) => {
  mainWindow.loadFile('dashboard.html');
});