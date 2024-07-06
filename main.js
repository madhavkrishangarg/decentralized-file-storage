const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const { dialog } = require('electron');

let mainWindow;
let pythonProcess;
let nodeId;
let portNumber;

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
  mainWindow.webContents.openDevTools();
}

function startPythonServer() {
  pythonProcess = spawn('python3', ['python/runner.py'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  console.log('Python server started');

  // pythonProcess.stdout.on('data', (data) => {
  //   console.log(`Python stdout: ${data}`);
  // });

  // pythonProcess.stderr.on('data', (data) => {
  //   console.error(`Python stderr: ${data}`);
  // });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  createWindow();
  startPythonServer();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

ipcMain.handle('start-node', async (event, knownPeer) => {
  console.log('Starting node with known peer:', knownPeer);
  try {
    const response = await axios.post('http://localhost:8080/start_node', { known_peer: knownPeer });
    console.log(response.data);
    nodeId = response.data.node_id;
    portNumber = response.data.port;
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('get-node-id', async () => {
  return nodeId;
});

ipcMain.handle('get-port-number', async () => {
  console.log('Getting port number:', portNumber);
  return portNumber;
});

ipcMain.handle('send-chat', async (event, message) => {
  try {
    const response = await axios.post('http://localhost:8080/chat_message', { message });
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('distribute-file', async (event, filePath) => {
  try {
    const response = await axios.post('http://localhost:8080/distribute_file', { file_path: filePath }, { timeout: 30000 });
    console.log(response.data);
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('retrieve-file', async (event, fileId, outputPath) => {
  try {
    const response = await axios.post('http://localhost:8080/retrieve_file', { file_id: fileId, output_path: outputPath }, { timeout: 30000 });
    console.log(response.data);
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('delete-file', async (event, fileId) => {
  try {
    const response = await axios.post('http://localhost:8080/delete_file', { file_id: fileId });
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('get-messages', async () => {
  try {
    const response = await axios.get('http://localhost:8080/get_messages');
    return response.data;
  } catch (error) {
    throw error;
  }
});

ipcMain.on('load-dashboard', (event) => {
  mainWindow.loadFile('dashboard.html');
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  return dialog.showSaveDialog(options);
});

ipcMain.on('stop-node', (event) => {
  console.log('Stopping node');
  axios.post('http://localhost:8080/stop_node');
});