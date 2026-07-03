const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("leoDesktop", {
  platform: process.platform,
  isDesktop: true
});
