const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const WebSocket = require('ws');
const axios = require('axios');

let mainWindow;
let pythonProcess;
let ws;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('landing.html');
}

function setupWebSocket() {
  ws = new WebSocket('ws://localhost:8080/ws');

  ws.on('open', function open() {
    console.log('Connected to WebSocket server');
  });

  ws.on('message', function incoming(data) {
    const message = JSON.parse(data);
    if (message.type === 'chat') {
      mainWindow.webContents.send('chat-message', message);
    }
  });

  ws.on('close', function close() {
    console.log('Disconnected from WebSocket server');
    setTimeout(setupWebSocket, 1000); // Try to reconnect after 1 second
  });

  ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
    setTimeout(setupWebSocket, 1000); // Try to reconnect after 1 second
  });
}

app.whenReady().then(() => {
  createWindow();
  setupWebSocket();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (pythonProcess) {
    await axios.post('http://localhost:8080/shutdown');
    pythonProcess.kill();
  }
  if (ws) ws.close();
});

ipcMain.on('start-node', async (event, knownPeer) => {
  try {
    const response = await axios.post('http://localhost:8080/initialize', { known_peer: knownPeer ? { ip: knownPeer.split(':')[0], port: parseInt(knownPeer.split(':')[1]) } : null });
    mainWindow.webContents.send('node-info', response.data);
  } catch (error) {
    mainWindow.webContents.send('node-error', error.message);
  }
});

ipcMain.handle('send-chat', async (event, message) => {
  try {
    const response = await axios.post('http://localhost:8080/chat', { message });
    return response.data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('distribute-file', async (event, filePath) => {
  try {
    const response = await axios.post('http://localhost:8080/distribute', { file_path: filePath });
    return response.data;
  } catch (error) {
    console.error('Error distributing file:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('retrieve-file', async (event, fileId, outputPath) => {
  try {
    const response = await axios.post('http://localhost:8080/retrieve', { file_id: fileId, output_path: outputPath });
    return response.data;
  } catch (error) {
    console.error('Error retrieving file:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('delete-file', async (event, fileId) => {
  try {
    const response = await axios.post('http://localhost:8080/delete', { file_id: fileId });
    return response.data;
  } catch (error) {
    console.error('Error deleting file:', error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.on('load-dashboard', (event) => {
  mainWindow.loadFile('dashboard.html');
});