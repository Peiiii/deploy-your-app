import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { getDesktopEntryUrl, getDesktopProtocol, getWebOrigin } from '../config';

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;

const createMainWindow = async (): Promise<void> => {
  const startUrl = getDesktopEntryUrl();
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

const completeDesktopLogin = async (token: string): Promise<void> => {
  const loginUrl = `${getWebOrigin()}/api/v1/auth/desktop/login?token=${encodeURIComponent(token)}`;
  const authWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await authWindow.loadURL(loginUrl);
  } catch (err) {
    console.error('Failed to complete desktop login', err);
  } finally {
    authWindow.close();
  }

  if (mainWindow) {
    await mainWindow.loadURL(getDesktopEntryUrl());
    mainWindow.show();
    mainWindow.focus();
  } else {
    await createMainWindow();
  }
};

const handleDeepLink = async (rawUrl: string): Promise<void> => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== `${getDesktopProtocol()}:`) {
      return;
    }
    const token = parsed.searchParams.get('token');
    if (token) {
      await completeDesktopLogin(token);
    }
  } catch (err) {
    console.error('Failed to handle deep link', err);
  }
};

const registerProtocol = (): void => {
  const scheme = getDesktopProtocol();
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(scheme, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient(scheme);
  }
};

const setupSingleInstance = (): boolean => {
  const lock = app.requestSingleInstanceLock();
  if (!lock) {
    app.quit();
    return false;
  }

  app.on('second-instance', (_event, argv) => {
    const deeplinkArg = argv.find((arg) =>
      arg.startsWith(`${getDesktopProtocol()}:`),
    );
    if (deeplinkArg) {
      void handleDeepLink(deeplinkArg);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  return true;
};

const processInitialDeepLink = (): void => {
  const deeplinkArg = process.argv.find((arg) =>
    arg.startsWith(`${getDesktopProtocol()}:`),
  );
  if (deeplinkArg) {
    pendingDeepLink = deeplinkArg;
  }
};

const bootstrap = async (): Promise<void> => {
  if (!setupSingleInstance()) {
    return;
  }

  app.setAppUserModelId('com.gemigo.desktop');
  await app.whenReady();
  registerProtocol();
  processInitialDeepLink();

  app.on('open-url', (event, url) => {
    event.preventDefault();
    pendingDeepLink = url;
    void handleDeepLink(url);
  });

  console.info('[desktop] loading web app from', getDesktopEntryUrl());
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });

  if (pendingDeepLink) {
    const link = pendingDeepLink;
    pendingDeepLink = null;
    await handleDeepLink(link);
  }
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
