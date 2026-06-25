const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  saveHTML: (content) => ipcRenderer.invoke('dialog:saveHTML', content),
  saveJSON: (content) => ipcRenderer.invoke('dialog:saveJSON', content),
  loadJSON: () => ipcRenderer.invoke('dialog:loadJSON'),
  resolveImage: (data) => ipcRenderer.invoke('file:resolveImage', data),
  fetchImage: (url) => ipcRenderer.invoke('network:fetchImage', url),
  
  // Close / Unsaved Changes IPC
  forceClose: () => ipcRenderer.send('app:force-close'),
  onCheckDirty: (callback) => ipcRenderer.on('app:check-dirty', (event, ...args) => callback(...args)),
  replyDirty: (data) => ipcRenderer.send('app:reply-dirty', data),
  onTriggerSaveAndClose: (callback) => ipcRenderer.on('app:trigger-save-and-close', (event, ...args) => callback(...args))
});
