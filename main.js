const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let forceClose = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // Disables CORS restrictions to ensure local images and canvas operations work flawlessly
    },
    title: "Image Map Editor",
    autoHideMenuBar: true
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    if (forceClose) return;
    e.preventDefault();
    mainWindow.webContents.send('app:check-dirty');
  });
}

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.disableHardwareAcceleration();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for System Operations
ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Image File',
    properties: ['openFile'],
    filters: [
      { name: 'Web-supported Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }
    ]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  let mimeType = `image/${ext}`;
  if (ext === 'svg') mimeType = 'image/svg+xml';
  if (ext === 'jpg') mimeType = 'image/jpeg';
  
  const base64 = buffer.toString('base64');
  return {
    path: filePath,
    name: path.basename(filePath),
    dataUrl: `data:${mimeType};base64,${base64}`
  };
});

ipcMain.handle('dialog:saveHTML', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export HTML Image Map',
    defaultPath: 'image-map.html',
    filters: [{ name: 'HTML Files', extensions: ['html'] }]
  });
  
  if (result.canceled || !result.filePath) {
    return { success: false };
  }
  
  fs.writeFileSync(result.filePath, content, 'utf8');
  return { success: true, filePath: result.filePath };
});

ipcMain.handle('dialog:saveJSON', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Editor Project',
    defaultPath: 'project.json',
    filters: [{ name: 'JSON Project Files', extensions: ['json'] }]
  });
  
  if (result.canceled || !result.filePath) {
    return { success: false };
  }
  
  fs.writeFileSync(result.filePath, content, 'utf8');
  return { success: true, filePath: result.filePath };
});

ipcMain.handle('dialog:loadJSON', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Editor Project',
    properties: ['openFile'],
    filters: [
      { name: 'Project Files', extensions: ['json', 'html', 'htm'] },
      { name: 'JSON Project Files', extensions: ['json'] },
      { name: 'HTML Files', extensions: ['html', 'htm'] }
    ]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf8');
  return {
    filePath,
    content
  };
});

ipcMain.handle('file:resolveImage', async (event, { htmlPath, imageSrc }) => {
  try {
    let targetPath = imageSrc;
    if (!path.isAbsolute(imageSrc)) {
      if (!htmlPath) return null;
      const htmlDir = path.dirname(htmlPath);
      targetPath = path.resolve(htmlDir, imageSrc);
    }
    
    if (!fs.existsSync(targetPath)) {
      return null;
    }
    const buffer = fs.readFileSync(targetPath);
    const ext = path.extname(targetPath).toLowerCase().replace('.', '');
    let mimeType = `image/${ext}`;
    if (ext === 'svg') mimeType = 'image/svg+xml';
    if (ext === 'jpg') mimeType = 'image/jpeg';
    
    const base64 = buffer.toString('base64');
    return {
      path: targetPath,
      name: path.basename(targetPath),
      dataUrl: `data:${mimeType};base64,${base64}`
    };
  } catch (err) {
    return null;
  }
});

// Securely fetch network images and handle specific error codes/conditions
ipcMain.handle('network:fetchImage', async (event, urlString) => {
  try {
    const response = await fetch(urlString);
    
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
        errorType: 'http-error'
      };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = buffer.toString('base64');
    
    return {
      success: true,
      dataUrl: `data:${contentType};base64,${base64}`,
      contentType
    };
  } catch (error) {
    let errorType = 'network-error';
    let message = error.message || '';
    
    if (message.includes('ENOTFOUND') || message.includes('fetch failed')) {
      errorType = 'connection-error';
    }
    
    return {
      success: false,
      errorType,
      message
    };
  }
});

ipcMain.on('app:force-close', () => {
  forceClose = true;
  if (mainWindow) mainWindow.close();
});

ipcMain.on('app:reply-dirty', (event, { isDirty }) => {
  if (isDirty) {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['저장하고 종료', '저장하지 않고 종료', '취소'],
      defaultId: 0,
      cancelId: 2,
      title: '종료 확인',
      message: '작업 중인 변경사항이 있습니다.',
      detail: '종료하기 전에 변경사항을 저장하시겠습니까?'
    });
    
    if (choice === 0) {
      mainWindow.webContents.send('app:trigger-save-and-close');
    } else if (choice === 1) {
      forceClose = true;
      mainWindow.close();
    }
  } else {
    forceClose = true;
    mainWindow.close();
  }
});
