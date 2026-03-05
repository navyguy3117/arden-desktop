import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ardenDesktop", {
  // App info
  getVersion: () => ipcRenderer.invoke("app:version"),
  getPlatform: () => ipcRenderer.invoke("app:platform"),

  // Window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  // Server port (local Hono API)
  getServerPort: () => ipcRenderer.invoke("server:port"),

  // Gateway bridge
  getGatewayUrl: () => ipcRenderer.invoke("gateway:url"),
  setGatewayUrl: (url: string) => ipcRenderer.invoke("gateway:set-url", url),
  checkGatewayHealth: () => ipcRenderer.invoke("gateway:health"),

  // File operations
  openFile: () => ipcRenderer.invoke("dialog:open-file"),
  saveFile: (content: string, defaultName: string) =>
    ipcRenderer.invoke("dialog:save-file", content, defaultName),

  // Events from main process
  onServerReady: (callback: (port: number) => void) =>
    ipcRenderer.on("server:ready", (_e, port) => callback(port)),
  onGatewayStatus: (callback: (status: any) => void) =>
    ipcRenderer.on("gateway:status", (_e, status) => callback(status)),
});
