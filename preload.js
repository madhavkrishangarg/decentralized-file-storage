const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  startNode: (knownPeer) => ipcRenderer.invoke('start-node', knownPeer),
  sendChat: (message) => ipcRenderer.invoke('send-chat', message),
  distributeFile: (filePath) => ipcRenderer.invoke('distribute-file', filePath),
  retrieveFile: (fileId, outputPath) => ipcRenderer.invoke('retrieve-file', fileId, outputPath),
  deleteFile: (fileId) => ipcRenderer.invoke('delete-file', fileId),
  loadDashboard: () => ipcRenderer.send('load-dashboard'),
  onWsStatus: (callback) => ipcRenderer.on('ws-status', callback),
  onChatMessage: (callback) => ipcRenderer.on('chat-message', callback)
})