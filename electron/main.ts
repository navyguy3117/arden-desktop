import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, dialog } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { startServer, stopServer } from "./server-bridge";
import { loadConfig, getConfig } from "../src/config";

// RTX 5070 — MUST disable hardware acceleration (NeonShell rule)
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverPort = 3141;

// Gateway config
let gatewayUrl = "http://10.10.10.175:18789";

// Window state persistence
const stateFile = path.join(app.getPath("userData"), "window-state.json");

function loadWindowState(): { x?: number; y?: number; width: number; height: number; maximized?: boolean } {
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    }
  } catch {}
  return { width: 1600, height: 1000 };
}

function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const state = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: mainWindow.isMaximized(),
  };
  try {
    fs.writeFileSync(stateFile, JSON.stringify(state));
  } catch {}
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0a0a14",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a14",
      symbolColor: "#4ff2f2",
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: fs.existsSync(path.join(__dirname, "../../arden.ico"))
      ? path.join(__dirname, "../../arden.ico")
      : undefined,
  });

  if (state.maximized) mainWindow.maximize();

  // Load renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Hide to tray on close
  mainWindow.on("close", (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    } else {
      saveWindowState();
    }
  });

  mainWindow.on("moved", saveWindowState);
  mainWindow.on("resized", saveWindowState);
}

function createTray() {
  const iconPath = path.join(__dirname, "../../arden.ico");
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error("Icon image is empty");
    icon = icon.resize({ width: 16, height: 16 });
  } catch {
    console.warn("[arden-desktop] Tray icon not found or invalid, using fallback");
    // Create a 16x16 cyan pixel as fallback
    const size = 16;
    const buf = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      buf[i * 4 + 0] = 0x4f; // R
      buf[i * 4 + 1] = 0xf2; // G
      buf[i * 4 + 2] = 0xf2; // B
      buf[i * 4 + 3] = 0xff; // A
    }
    icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
  }
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show Arden", click: () => mainWindow?.show() },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Arden Desktop");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => mainWindow?.show());
}

// IPC Handlers
function registerIPC() {
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:platform", () => process.platform);
  ipcMain.handle("server:port", () => serverPort);

  ipcMain.handle("gateway:url", () => gatewayUrl);
  ipcMain.handle("gateway:set-url", (_e, url: string) => {
    gatewayUrl = url;
    return gatewayUrl;
  });
  ipcMain.handle("gateway:health", async () => {
    try {
      const res = await fetch(`${gatewayUrl}/health`);
      return await res.json();
    } catch {
      return { status: "unreachable" };
    }
  });

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on("window:close", () => mainWindow?.close());

  ipcMain.handle("dialog:open-file", async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
    });
    return result.filePaths;
  });

  ipcMain.handle("dialog:save-file", async (_e, content: string, defaultName: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName });
    if (result.filePath) {
      fs.writeFileSync(result.filePath, content);
      return result.filePath;
    }
    return null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Load persisted config
  const dataDir = path.join(os.homedir(), ".arden-desktop");
  const cfg = loadConfig(dataDir);
  gatewayUrl = cfg.gatewayUrl;
  serverPort = cfg.serverPort;
  console.log(`[arden-desktop] Config loaded — gateway: ${gatewayUrl}, port: ${serverPort}`);

  registerIPC();

  // Start embedded Hono server
  serverPort = await startServer(serverPort, gatewayUrl);
  console.log(`[arden-desktop] Server running on port ${serverPort}`);

  createWindow();
  createTray();

  // Alt+Space global hotkey — Mini-Arden command bar
  globalShortcut.register("Alt+Space", () => {
    if (mainWindow?.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // Notify renderer that server is ready
  mainWindow?.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send("server:ready", serverPort);
  });
});

app.on("window-all-closed", () => {
  // Don't quit — hide to tray
});

app.on("before-quit", async () => {
  (app as any).isQuitting = true;
  globalShortcut.unregisterAll();
  await stopServer();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

// Electron Forge Vite declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
