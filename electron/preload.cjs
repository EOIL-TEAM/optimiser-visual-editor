const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("optimiserEditor", {
  openTrace: () => ipcRenderer.invoke("trace:open"),
  platform: process.platform,
});
