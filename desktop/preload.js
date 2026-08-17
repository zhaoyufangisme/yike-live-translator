/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("yikeNative", {
  platform: "windows",
  getConfig: () => ipcRenderer.invoke("config:get"), saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  translate: (request) => ipcRenderer.invoke("provider:translate", request), testProvider: (provider) => ipcRenderer.invoke("provider:test", provider), getQuota: (provider) => ipcRenderer.invoke("provider:quota", provider),
  listArgosPackages: () => ipcRenderer.invoke("argos:list"), installArgosPackage: (fromCode, toCode) => ipcRenderer.invoke("argos:install", fromCode, toCode), deleteArgosPackage: (fromCode, toCode) => ipcRenderer.invoke("argos:delete", fromCode, toCode),
});
