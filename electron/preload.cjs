const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timeLog', {
  chooseNotesDirectory: () => ipcRenderer.invoke('notes:directory'),
  getNotesDirectory: () => ipcRenderer.invoke('notes:get-directory'),
  listNoteDates: (directory) => ipcRenderer.invoke('notes:list-dates', directory),
  readWeekNotes: (range) => ipcRenderer.invoke('notes:read-week', range),
  onHistoryAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('history:action', listener);
    return () => ipcRenderer.removeListener('history:action', listener);
  },
});
