const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const isDev = !app.isPackaged;
const appIcon = path.join(__dirname, '../build/icon.png');
app.setName('Time Log');

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 320,
    minHeight: 520,
    title: 'Time Log',
    backgroundColor: '#eee9f3',
    icon: isDev ? appIcon : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) window.loadURL('http://127.0.0.1:5173');
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}

async function findMarkdown(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) found.push(...await findMarkdown(fullPath));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) found.push({ entry, fullPath });
  }
  return found;
}

ipcMain.handle('notes:list-dates', async (_event, directory) => {
  if (!directory) return [];
  const markdownFiles = await findMarkdown(directory);
  return [...new Set(markdownFiles.map(({ entry }) => entry.name.match(/\d{4}-\d{2}-\d{2}/)?.[0]).filter(Boolean))].sort();
});

ipcMain.handle('notes:directory', async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const options = {
    title: 'Choose your Obsidian vault or daily notes folder',
    properties: ['openDirectory'],
    buttonLabel: 'Use This Folder',
  };
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;
  const directory = result.filePaths[0];
  try {
    const settingsPath = path.join(app.getPath('userData'), 'notes-directory.json');
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify({ directory }), 'utf8');
    return { directory };
  } catch (error) {
    throw new Error(`Folder selected, but Time Log could not save its location: ${error.message}`);
  }
});

ipcMain.handle('notes:read-week', async (_event, { directory, startDate, endDate }) => {
  if (!directory) return [];
  const markdownFiles = await findMarkdown(directory);
  return Promise.all(markdownFiles
    .map(async ({ entry, fullPath }) => {
      const date = entry.name.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (!date || date < startDate || date > endDate) return null;
      return { name: entry.name, path: fullPath, date, content: await fs.readFile(fullPath, 'utf8') };
    }))
    .then((files) => files.filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)));
});

ipcMain.handle('notes:get-directory', async () => {
  try {
    const saved = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'notes-directory.json'), 'utf8'));
    return saved.directory;
  } catch {
    return null;
  }
});

app.whenReady().then(() => {
  if (isDev && process.platform === 'darwin' && app.dock) app.dock.setIcon(nativeImage.createFromPath(appIcon));
  createWindow();
  const template = [
    { label: 'Time Log', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: (_item, window) => window?.webContents.send('history:action', 'undo') },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', click: (_item, window) => window?.webContents.send('history:action', 'redo') },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
