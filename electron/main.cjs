const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const appName = "Leo的生活学习助手";
const port = Number(process.env.LEO_PORT || process.env.PORT || 3011);
const host = process.env.LEO_HOST || "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const healthUrl = `${baseUrl}/api/health`;
const isDev = !app.isPackaged;
const appDataDir = process.env.LEO_APP_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", appName);
const logDir = process.env.LEO_LOG_DIR || path.join(os.homedir(), "Library", "Logs", appName);
const logPath = path.join(logDir, "desktop.log");

let mainWindow = null;
let backendProcess = null;
let backendOwnedByDesktop = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.exit(0);
}

function ensureDirs() {
  fs.mkdirSync(appDataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
}

function log(message, extra) {
  ensureDirs();
  const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${suffix}\n`);
}

async function checkHealth(timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    log("Health check ok", {
      port,
      databasePath: data.databasePath,
      dataDir: data.dataDir,
      uploadsDir: data.uploadsDir
    });
    return true;
  } catch (error) {
    log("Health check failed", { port, error: error.message });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function isPortOpen(timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForExistingBackend() {
  if (!(await isPortOpen())) return false;
  log("Port is already open, waiting for existing backend health", { port });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    if (await checkHealth(2500)) {
      backendOwnedByDesktop = false;
      log("Using existing backend", { port });
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`端口 ${port} 已被占用，但健康检查没有通过。请关闭占用该端口的程序，或查看日志：${logPath}`);
}

function appRoot() {
  return app.isPackaged ? app.getAppPath() : path.join(__dirname, "..");
}

function startBackend() {
  const cwd = appRoot();
  const env = {
    ...process.env,
    LEO_PORT: String(port),
    PORT: String(port),
    LEO_HOST: host,
    HOSTNAME: host,
    LEO_APP_DATA_DIR: appDataDir,
    LEO_LOG_DIR: logDir,
    NODE_ENV: isDev ? "development" : "production"
  };
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");

  if (isDev) {
    backendProcess = spawn(process.execPath, [nextBin, "dev", "-H", host, "-p", String(port)], {
      cwd,
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
  } else {
    const standaloneDir = path.join(cwd, ".next", "standalone");
    const standaloneServer = path.join(standaloneDir, "server.js");
    backendProcess = spawn(process.execPath, [standaloneServer], {
      cwd: standaloneDir,
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
  }

  backendOwnedByDesktop = true;
  log("Backend process started by desktop", { pid: backendProcess.pid, port, cwd });
  backendProcess.stdout.on("data", (chunk) => log("Backend stdout", { message: chunk.toString().trim().slice(0, 500) }));
  backendProcess.stderr.on("data", (chunk) => log("Backend stderr", { message: chunk.toString().trim().slice(0, 500) }));
  backendProcess.on("exit", (code, signal) => {
    log("Backend process exited", { code, signal, owned: backendOwnedByDesktop });
    backendProcess = null;
    backendOwnedByDesktop = false;
  });
}

function stopOwnedBackend(signal = "SIGTERM") {
  if (backendOwnedByDesktop && backendProcess && !backendProcess.killed) {
    log("Stopping desktop-owned backend", { pid: backendProcess.pid, signal });
    backendProcess.kill(signal);
  }
}

async function waitForBackend() {
  if (await checkHealth()) {
    backendOwnedByDesktop = false;
    log("Using existing backend", { port });
    return;
  }
  if (await waitForExistingBackend()) return;

  startBackend();
  const startedAt = Date.now();
  while (Date.now() - startedAt < 45000) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (await checkHealth(2500)) return;
  }

  throw new Error(`本地后端启动超时。请检查端口 ${port} 是否被占用，日志位置：${logPath}`);
}

function loadingHtml() {
  return encodeURIComponent(`
    <html>
      <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;height:100vh">
        <div style="text-align:center">
          <div style="font-size:20px;font-weight:700">Leo的生活学习助手</div>
          <div style="margin-top:10px;color:#64748b">正在启动本地服务...</div>
        </div>
      </body>
    </html>
  `);
}

function errorHtml(error) {
  return encodeURIComponent(`
    <html>
      <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;height:100vh">
        <div style="max-width:640px;padding:24px">
          <h1 style="font-size:22px">本地后端启动失败</h1>
          <p style="line-height:1.6;color:#475569">${String(error.message || error)}</p>
          <p style="line-height:1.6;color:#475569">请确认端口 ${port} 没有被其他程序占用，并查看日志：</p>
          <code style="display:block;white-space:pre-wrap;background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px">${logPath}</code>
        </div>
      </body>
    </html>
  `);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: appName,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(baseUrl)) event.preventDefault();
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(`data:text/html;charset=utf-8,${loadingHtml()}`);
}

async function boot() {
  ensureDirs();
  log("Desktop app starting", { version: app.getVersion(), packaged: app.isPackaged, port });
  createWindow();
  try {
    await waitForBackend();
    await mainWindow.loadURL(baseUrl);
  } catch (error) {
    log("Desktop app failed to start backend", { error: error.message });
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${errorHtml(error)}`);
  }
}

app.whenReady().then(boot);

app.on("second-instance", () => {
  log("Second app instance requested; focusing existing window");
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void boot();
});

app.on("before-quit", () => {
  log("Desktop app quitting", { ownedBackend: backendOwnedByDesktop, backendPid: backendProcess?.pid });
  stopOwnedBackend();
});

process.on("SIGINT", () => {
  stopOwnedBackend("SIGINT");
  app.quit();
});

process.on("SIGTERM", () => {
  stopOwnedBackend("SIGTERM");
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
