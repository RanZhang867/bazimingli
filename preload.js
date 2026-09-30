const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  uploadAvatar: () => ipcRenderer.invoke('upload-avatar'),
  saveData: data => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
  autoLoad: () => ipcRenderer.invoke('auto-load'),
  autoSave: data => ipcRenderer.invoke('auto-save', data),
  paipan: info => ipcRenderer.invoke('paipan', info),
  tuili: (chart, info) => ipcRenderer.invoke('tuili', chart, info),
  liunianBatch: (chart, info, sy, ey) => ipcRenderer.invoke('liunian-batch', chart, info, sy, ey),
  exportPdf: (html, name) => ipcRenderer.invoke('export-pdf', html, name),
  divine: (question, lines) => ipcRenderer.invoke('divine', question, lines),
  loadDivineHistory: () => ipcRenderer.invoke('divine-history-load'),
  saveDivineHistory: data => ipcRenderer.invoke('divine-history-save', data)
});
