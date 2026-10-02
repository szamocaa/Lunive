// The update popup, drawn over the game when a new version is out: what's new, UPDATE, or LATER.
const { ipcRenderer } = require('electron');

const CSS = `
#lnvUpd{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,rgba(30,18,60,.7),rgba(3,3,10,.88));
  backdrop-filter:blur(6px);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;animation:luIn .25s ease-out;}
@keyframes luIn{from{opacity:0}to{opacity:1}}
#lnvUpd .lu-card{width:min(480px,90vw);padding:26px 26px 22px;border-radius:22px;color:#fff;text-align:center;
  background:radial-gradient(120% 80% at 50% 0%,rgba(255,214,107,.18),transparent 60%),linear-gradient(180deg,rgba(34,30,56,.98),rgba(14,13,26,.98));
  border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px -20px rgba(0,0,0,.8),0 0 0 1px rgba(255,214,107,.08) inset;animation:luPop .35s cubic-bezier(.2,1.4,.4,1);}
@keyframes luPop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
#lnvUpd .lu-tag{display:inline-block;padding:4px 12px;border-radius:999px;font:800 11px/1 system-ui,sans-serif;letter-spacing:.24em;color:#2a1300;background:linear-gradient(180deg,#fff0b8,#ffc94a);}
#lnvUpd h2{margin:14px 0 4px;font:900 30px/1.1 system-ui,sans-serif;letter-spacing:.02em;}
#lnvUpd .lu-from{font:600 12px system-ui,sans-serif;color:rgba(255,255,255,.55);letter-spacing:.06em;}
#lnvUpd .lu-msg{margin:16px 0 4px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font:500 14.5px/1.45 system-ui,sans-serif;color:#efeaf8;}
#lnvUpd .lu-msg:empty{display:none;}
#lnvUpd .lu-go{display:block;width:100%;margin-top:18px;padding:15px;border:0;border-radius:14px;cursor:pointer;font:900 17px system-ui,sans-serif;letter-spacing:.28em;color:#2a1300;
  background:linear-gradient(180deg,#fff0b8,#ffc94a 55%,#f5a623);box-shadow:0 14px 30px -12px rgba(255,190,60,.85),inset 0 1px 0 rgba(255,255,255,.6);transition:transform .1s,filter .15s;}
#lnvUpd .lu-go:hover{filter:brightness(1.07);} #lnvUpd .lu-go:active{transform:scale(.97);}
#lnvUpd .lu-later{margin-top:10px;background:none;border:0;color:rgba(255,255,255,.5);font:700 12px system-ui,sans-serif;letter-spacing:.2em;cursor:pointer;padding:6px 12px;}
#lnvUpd .lu-later:hover{color:#fff;}
#lnvUpd .lu-bar{display:none;margin-top:20px;height:12px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;}
#lnvUpd .lu-bar i{display:block;height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#ffc94a,#fff0b8);transition:width .15s;}
#lnvUpd .lu-st{display:none;margin-top:10px;font:700 12px system-ui,sans-serif;letter-spacing:.16em;color:rgba(255,255,255,.7);}
#lnvUpd.busy .lu-go,#lnvUpd.busy .lu-later{display:none;} #lnvUpd.busy .lu-bar,#lnvUpd.busy .lu-st{display:block;}
#lnvUpd .lu-err{color:#ff8aa0;}`;

function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

ipcRenderer.on('lunive-update', (_e, raw) => {
  const info = JSON.parse(raw);
  if (document.getElementById('lnvUpd')) return;
  if (!document.getElementById('lnvUpdCss')) { const st = document.createElement('style'); st.id = 'lnvUpdCss'; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.id = 'lnvUpd';
  el.innerHTML = `<div class="lu-card"><span class="lu-tag">NEW UPDATE</span><h2>Lunive ${esc(info.version)}</h2>
    <div class="lu-from">You have ${esc(info.from)}</div><div class="lu-msg">${esc(info.message)}</div>
    <button class="lu-go">UPDATE</button><button class="lu-later">LATER</button>
    <div class="lu-bar"><i></i></div><div class="lu-st">DOWNLOADING…</div></div>`;
  document.body.appendChild(el);
  if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) {}
  el.querySelector('.lu-later').onclick = () => el.remove();
  el.querySelector('.lu-go').onclick = () => { el.classList.add('busy'); ipcRenderer.invoke('lunive-update-now'); };
});
ipcRenderer.on('lunive-update-progress', (_e, raw) => {
  const p = JSON.parse(raw), el = document.getElementById('lnvUpd'); if (!el) return;
  const st = el.querySelector('.lu-st');
  if (p.error) { st.textContent = 'UPDATE FAILED: ' + p.error.toUpperCase() + ' · TRY AGAIN LATER'; st.classList.add('lu-err'); setTimeout(() => el.remove(), 5000); return; }
  el.querySelector('.lu-bar i').style.width = Math.round((p.k || 0) * 100) + '%';
  st.textContent = p.done ? 'UPDATED · RESTARTING…' : 'DOWNLOADING… ' + Math.round((p.k || 0) * 100) + '%';
});
