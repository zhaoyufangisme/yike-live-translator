const { app, BrowserWindow } = require("electron");

const APP_URL = "https://yike-live-translator-2026.wwpbbms123.chatgpt.site/";

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 760,
    minHeight: 620,
    title: "译刻",
    backgroundColor: "#f4f3ed",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.loadURL(APP_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
