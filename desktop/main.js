// Lunive, as a desktop app: the same game the website runs, in its own window.
// The game is served from inside the app (app://lunive/), so saves live on this computer and nothing needs a web browser.
// Updates: the app checks GitHub for a newer version of the game; one click downloads it (one file) and restarts into it.
const { app, BrowserWindow, Menu, ipcMain, net, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const BUNDLED = path.join(__dirname, 'app');                       // the game this app shipped with
const FEED = process.env.LUNIVE_UPDATE_FEED || 'https://github.com/szamocaa/Lunive/releases/latest/download/update.json';
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
let UPD = null;                                                      // where downloaded updates live (set once the app is ready)

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');  // the lobby music starts without a click first
app.commandLine.appendSwitch('ignore-gpu-blocklist');                          // use the graphics card even if the driver is on Chromium's blocklist

if (!app.requestSingleInstanceLock()) app.quit();

/* ---------- which game to run: the one that came with the app, or a newer one downloaded since ---------- */
function verCmp(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; }
function game() {
  try { const v = fs.readFileSync(path.join(UPD, 'version.txt'), 'utf8').trim();
    if (verCmp(v, app.getVersion()) > 0 && fs.existsSync(path.join(UPD, 'index.html'))) return { dir: UPD, ver: v }; } catch (e) {}
  return { dir: BUNDLED, ver: app.getVersion() };
}

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 960, minHeight: 560,
    title: 'Lunive', backgroundColor: '#05060a', show: false, autoHideMenuBar: true,
    icon: path.join(BUNDLED, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL('app://lunive/index.html');
  // links out of the game (Instagram, the download page, e-mail links) open in the normal browser, never inside the game window
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); } });
  // F11 (or Alt+Enter) for fullscreen
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && (i.key === 'F11' || (i.alt && i.key === 'Enter'))) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.on('did-finish-load', () => { setTimeout(checkUpdate, 4000); });
  win.on('closed', () => { win = null; });
}

/* ---------- updates ---------- */
let offer = null, offered = '', busy = false;
async function checkUpdate() {
  if (busy || !win) return;
  let j; try { const r = await net.fetch(FEED + (FEED.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; j = await r.json(); } catch (e) { return; }
  if (!j || !j.version || !j.game || verCmp(j.version, game().ver) <= 0 || offered === j.version) return;
  offer = j; offered = j.version;
  win.webContents.send('lunive-update', JSON.stringify({ version: j.version, message: j.message || '', from: game().ver }));
}
ipcMain.handle('lunive-update-now', async () => {
  if (!offer || busy) return false; busy = true;
  const send = p => { if (win) win.webContents.send('lunive-update-progress', JSON.stringify(p)); };
  try {
    const url = new URL(offer.game, FEED).toString();
    const r = await net.fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = +r.headers.get('content-length') || 0, reader = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(Buffer.from(value)); got += value.length; if (total) send({ k: got / total }); }
    const buf = Buffer.concat(parts);
    if (offer.sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== offer.sha256) throw new Error('the download was damaged');
    let html = buf.toString('utf8');
    if (!html.includes("LUNIVE_VER='" + offer.version + "'")) throw new Error('that is not Lunive ' + offer.version);
    html = html.split(CDN).join('three.min.js');                     // three.js comes with the app
    fs.mkdirSync(UPD, { recursive: true });
    fs.writeFileSync(path.join(UPD, 'index.tmp'), html); fs.renameSync(path.join(UPD, 'index.tmp'), path.join(UPD, 'index.html'));
    fs.writeFileSync(path.join(UPD, 'version.txt'), offer.version);
    send({ k: 1, done: true });
    setTimeout(() => { busy = false; offer = null; if (win) win.loadURL('app://lunive/index.html'); }, 900);
    return true;
  } catch (e) { busy = false; send({ error: String(e && e.message || e) }); return false; }
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  UPD = path.join(app.getPath('userData'), 'game');
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (!p || p === '/') p = '/index.html';
    for (const dir of [game().dir, BUNDLED]) {                       // the newest game first; three.js and the icon from the app itself
      const f = path.normalize(path.join(dir, p));
      if (f.startsWith(dir) && fs.existsSync(f)) return net.fetch(pathToFileURL(f).toString());
    }
    return new Response('Not found', { status: 404 });
  });
  // on a Mac the menu bar keeps Quit, and copy and paste for the Kyuchi ID fields; elsewhere there is no menu bar
  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
    : null);
  createWindow();
  setInterval(checkUpdate, 20 * 60 * 1000);                          // and every twenty minutes while you play
});

app.on('window-all-closed', () => app.quit());
