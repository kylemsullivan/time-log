const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timeLog', {
  chooseNotesDirectory: () => ipcRenderer.invoke('notes:directory'),
  getNotesDirectory: () => ipcRenderer.invoke('notes:get-directory'),
  listNoteDates: (directory) => ipcRenderer.invoke('notes:list-dates', directory),
  readWeekNotes: (range) => ipcRenderer.invoke('notes:read-week', range),
  loadSpans: () => ipcRenderer.invoke('spans:load'),
  saveSpans: (days) => ipcRenderer.invoke('spans:save', days),
  exportFile: (file) => ipcRenderer.invoke('files:export', file),
  importFile: () => ipcRenderer.invoke('files:import'),
  onHistoryAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('history:action', listener);
    return () => ipcRenderer.removeListener('history:action', listener);
  },
});
