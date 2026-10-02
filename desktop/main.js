// Lunive, as a desktop app: the same game the website runs, in its own window.
// The game is served from inside the app (app://lunive/), so saves live on this computer and nothing needs a web browser.
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, 'app');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');  // the lobby music starts without a click first
app.commandLine.appendSwitch('ignore-gpu-blocklist');                          // use the graphics card even if the driver is on Chromium's blocklist

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 960, minHeight: 560,
    title: 'Lunive', backgroundColor: '#05060a', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'app', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL('app://lunive/index.html');
  // links out of the game (Instagram, e-mail links) open in the normal browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); } });
  // F11 (or Alt+Enter) for fullscreen
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && (i.key === 'F11' || (i.alt && i.key === 'Enter'))) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (!p || p === '/') p = '/index.html';
    const f = path.normalize(path.join(ROOT, p));
    if (!f.startsWith(ROOT)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(f).toString());
  });
  // on a Mac the menu bar keeps Quit, and copy and paste for the Kyuchi ID fields; elsewhere there is no menu bar
  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
    : null);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
