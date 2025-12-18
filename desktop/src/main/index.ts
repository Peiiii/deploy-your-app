import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { getWebUrl } from '../config';

let mainWindow: BrowserWindow | null = null;

const createMainWindow = async (): Promise<void> => {
  const startUrl = getWebUrl();
  const preloadPath = path.join(__dirname, '..', 'preload', 'index.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    title: 'Gemigo Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Keep the shell thin: any window.open navigations go to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => undefined);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(startUrl);
};

const bootstrap = async (): Promise<void> => {
  app.setAppUserModelId('com.gemigo.desktop');
  await app.whenReady();

  console.info('[desktop] loading web app from', getWebUrl());
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

bootstrap().catch((err) => {
  console.error('Failed to bootstrap desktop shell', err);
  app.quit();
});
