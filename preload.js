const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startNode: (knownPeer) => ipcRenderer.invoke('start-node', knownPeer),
  sendChat: (message) => ipcRenderer.invoke('send-chat', message),
  distributeFile: (filePath) => ipcRenderer.invoke('distribute-file', filePath),
  retrieveFile: (fileId, outputPath) => ipcRenderer.invoke('retrieve-file', fileId, outputPath),
  deleteFile: (fileId) => ipcRenderer.invoke('delete-file', fileId),
  getMessages: () => ipcRenderer.invoke('get-messages'),
  loadDashboard: () => ipcRenderer.send('load-dashboard'),
  getNodeId: () => ipcRenderer.invoke('get-node-id'),
  getPortNumber: () => ipcRenderer.invoke('get-port-number'),
  stopNode: () => ipcRenderer.send('stop-node'),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
});