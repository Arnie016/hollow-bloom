// Screens: diegetic backpack, title menu + save slots, pause, settings, death, notes, workbench.
// Keyboard-first (arrows/WASD + Enter + Esc/Tab); mouse works too.
import * as S from './save.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// --- procedural surface textures for the UI (canvas → data URL) ---------------------------
function fabricURL(base = [62, 56, 44], w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.08})`; g.fillRect(0, y, w, 1); }       // weft
  for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,240,210,${0.02 + Math.random() * 0.04})`; g.fillRect(x, 0, 1, h); } // warp
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,235,200'},${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1); }
  for (let i = 0; i < 14; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${30 + Math.random() * 20},${20 + Math.random() * 10},10,${0.12 + Math.random() * 0.14})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } // grime
  return c.toDataURL('image/jpeg', 0.86);
}
function leatherURL() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#5a3a24'); gr.addColorStop(1, '#3a2416'); g.fillStyle = gr; g.fillRect(0, 0, 512, 96);
  for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,220,180'},${Math.random() * 0.1})`; g.fillRect(Math.random() * 512, Math.random() * 96, 1 + Math.random() * 3, 1 + Math.random()); }
  for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(20,10,5,${Math.random() * 0.3})`; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 96; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 10); g.stroke(); }
  g.strokeStyle = 'rgba(230,200,150,0.35)'; g.setLineDash([7, 6]); g.lineWidth = 2; g.strokeRect(8, 8, 496, 80);
  return c.toDataURL('image/jpeg', 0.88);
}
function paperURL() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#ddd2b6'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,40,20' : '255,250,235'},${Math.random() * 0.08})`; g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 6; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 40 + Math.random() * 120; const gr = g.createRadialGradient(x, y, r * 0.6, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.9, 'rgba(120,80,30,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  return c.toDataURL('image/jpeg', 0.86);
}

const CSS = (fab, fabDark, leather, paper) => `
.scr { position: fixed; inset: 0; display: none; z-index: 8; font-family: "Helvetica Neue", Arial, sans-serif; color: #efe6d2; }
.scr.on { display: block; }
.kc { display: inline-block; min-width: 18px; padding: 1px 6px; border: 1px solid rgba(240,225,195,0.55); border-radius: 4px; font: 600 11px/16px "Helvetica Neue", Arial; text-align: center; margin-right: 6px; color: #f4ead6; background: rgba(0,0,0,0.25); }
/* ---------- backpack ---------- */
#packScr .shade { position: absolute; inset: 0; background: radial-gradient(ellipse at 28% 58%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.72) 100%); }
#packScr .bag { position: absolute; right: 3vw; top: 50%; width: min(640px, 50vw); max-height: 92vh; overflow: hidden; transform: translateY(-50%) rotate(-0.35deg); border-radius: 16px;
  background: url(${fab}) center/512px; box-shadow: 0 40px 90px rgba(0,0,0,0.75), inset 0 0 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,235,200,0.06); animation: bagIn 0.32s cubic-bezier(.2,.9,.3,1.1); }
@keyframes bagIn { from { transform: translateY(-46%) rotate(1.5deg) scale(0.96); opacity: 0; } }
#packScr .bag::after { content: ''; position: absolute; inset: 9px; border: 2px dashed rgba(235,215,175,0.26); border-radius: 11px; pointer-events: none; }
#packScr .head { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 16px 30px 15px; background: url(${leather}) center/cover; box-shadow: 0 4px 10px rgba(0,0,0,0.45); }
#packScr .head::before, #packScr .head::after { content: ''; position: absolute; top: 50%; width: 9px; height: 9px; margin-top: -4px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #e8d6a8, #7a6034 70%); box-shadow: 0 1px 2px #000; }
#packScr .head::before { left: 13px; } #packScr .head::after { right: 13px; }
#packScr .head h2 { margin: 0; font: 600 14px/1 "Helvetica Neue"; letter-spacing: 0.45em; color: #f1e2c4; text-shadow: 0 1px 2px #000; }
#packScr .head .hint { font-size: 11px; letter-spacing: 0.12em; opacity: 0.8; }
#packScr .body { padding: 14px 26px 18px; }
#packScr .row { display: grid; grid-template-columns: 92px 1fr; align-items: center; margin: 7px 0; }
#packScr .row > label { font: 600 10px/1.3 "Helvetica Neue"; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(240,225,195,0.62); }
#packScr .pks { display: flex; gap: 9px; flex-wrap: wrap; }
.pk { position: relative; width: 82px; height: 82px; border-radius: 9px; cursor: pointer; background: url(${fabDark}) center/256px; border: 1px solid rgba(255,240,210,0.09); box-shadow: inset 0 3px 10px rgba(0,0,0,0.65), 0 1px 0 rgba(255,240,210,0.05); transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s; }
.pk img { position: absolute; left: 7px; top: 5px; width: 68px; height: 68px; object-fit: contain; filter: drop-shadow(0 5px 4px rgba(0,0,0,0.6)); transition: transform 0.15s; }
.pk .n { position: absolute; right: 7px; bottom: 5px; font: 700 17px/1 "Helvetica Neue"; color: #f6ecd6; text-shadow: 0 1px 3px #000, 0 0 6px rgba(0,0,0,0.8); }
.pk .tag { position: absolute; left: 6px; top: 5px; font: 700 8px/1 "Helvetica Neue"; letter-spacing: 0.14em; padding: 3px 5px; border-radius: 3px; background: rgba(216,200,160,0.92); color: #2a2216; }
.pk .bar { position: absolute; left: 8px; right: 8px; bottom: 4px; height: 3px; background: rgba(0,0,0,0.5); border-radius: 2px; overflow: hidden; } .pk .bar i { display: block; height: 100%; background: #d8c48a; }
.pk.empty img { opacity: 0.2; filter: grayscale(1) brightness(0.8); } .pk.empty .n { color: rgba(240,225,195,0.35); }
.pk.ready::before { content: ''; position: absolute; right: 7px; top: 7px; width: 8px; height: 8px; border-radius: 50%; background: #9fd27a; box-shadow: 0 0 8px #9fd27a; }
.pk.busy::before { content: ''; position: absolute; inset: 0; border-radius: 9px; background: conic-gradient(rgba(240,220,160,0.35) calc(var(--k) * 360deg), transparent 0); }
.pk.sel { border-color: #efd9a2; box-shadow: 0 0 0 2px rgba(239,217,162,0.7), 0 10px 18px rgba(0,0,0,0.45), inset 0 3px 10px rgba(0,0,0,0.5); transform: translateY(-3px); }
.pk.sel img { transform: scale(1.08) rotate(-3deg); }
#packScr .det { display: grid; grid-template-columns: 170px 1fr; gap: 18px; margin-top: 14px; padding-top: 16px; border-top: 2px dashed rgba(235,215,175,0.2); min-height: 178px; }
#packScr .det .big { width: 170px; height: 170px; object-fit: contain; filter: drop-shadow(0 12px 10px rgba(0,0,0,0.6)); }
.tape { display: inline-block; padding: 3px 14px 5px; background: linear-gradient(#e2d8b8, #cfc39e); color: #262014; font: 24px/1.1 "Marker Felt", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", cursive; transform: rotate(-1.6deg); box-shadow: 0 2px 5px rgba(0,0,0,0.45); clip-path: polygon(1% 6%, 99% 0, 100% 92%, 0 100%); }
#packScr .cat { margin: 9px 0 6px; font: 600 10px/1 "Helvetica Neue"; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(240,225,195,0.55); }
#packScr .desc { margin: 0 0 10px; font-size: 14px; line-height: 1.45; color: rgba(245,236,216,0.92); }
#packScr .stats { display: grid; grid-template-columns: 74px 1fr; gap: 3px 10px; font-size: 11px; letter-spacing: 0.08em; margin-bottom: 8px; color: rgba(245,236,216,0.75); }
#packScr .pips i { display: inline-block; width: 13px; height: 6px; margin-right: 3px; border-radius: 2px; background: rgba(255,255,255,0.12); } #packScr .pips i.on { background: #e2cc8e; }
#packScr .need { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
#packScr .need span { display: flex; align-items: center; gap: 5px; padding: 3px 8px 3px 3px; border-radius: 6px; background: rgba(0,0,0,0.3); font: 600 12px/1 "Helvetica Neue"; }
#packScr .need img { width: 26px; height: 26px; object-fit: contain; } #packScr .need .ok { color: #a9dc86; } #packScr .need .no { color: #f09a86; }
#packScr .acts { display: flex; gap: 16px; font-size: 12px; letter-spacing: 0.1em; margin-top: 6px; } #packScr .acts .dim { opacity: 0.45; }
#packScr .foot { display: flex; justify-content: space-between; margin-top: 12px; font-size: 11px; letter-spacing: 0.1em; color: rgba(240,225,195,0.6); }
/* ---------- menus (title / pause / settings / death) ---------- */
.menu { list-style: none; margin: 0; padding: 0; }
.menu li { position: relative; padding: 10px 0 10px 22px; font: 300 22px/1.15 "Helvetica Neue"; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(239,230,210,0.62); cursor: pointer; transition: color 0.15s, padding 0.15s; }
.menu li small { display: block; margin-top: 5px; font: 400 11px/1.3 "Helvetica Neue"; letter-spacing: 0.14em; text-transform: none; color: rgba(239,230,210,0.55); }
.menu li.sel { color: #fff6e2; padding-left: 30px; } .menu li.sel::before { content: ''; position: absolute; left: 6px; top: 50%; width: 12px; height: 2px; background: #e8cf94; }
.menu li.off { opacity: 0.35; }
.panelM { position: absolute; left: 8vw; top: 50%; transform: translateY(-50%); max-width: 560px; }
.panelM h1 { margin: 0 0 6px; font: 200 46px/1.05 "Helvetica Neue"; letter-spacing: 0.5em; }
.panelM .sub { margin: 0 0 34px; font-size: 11px; letter-spacing: 0.35em; opacity: 0.55; }
.foothint { position: absolute; left: 8vw; bottom: 5vh; font-size: 11px; letter-spacing: 0.16em; opacity: 0.6; }
#pauseScr, #setScr, #deathScr, #notesScr, #benchScr { background: rgba(6,6,5,0.72); backdrop-filter: blur(5px); }
.slots { margin-top: 10px; max-height: 56vh; overflow: auto; }
.slot2 { position: relative; padding: 14px 18px 16px; margin-bottom: 10px; border-radius: 10px; border: 1px solid rgba(255,240,210,0.1); background: rgba(0,0,0,0.35); cursor: pointer; }
.slot2.sel { border-color: #e8cf94; background: rgba(232,207,148,0.08); }
.slot2 b { font: 500 16px/1.2 "Helvetica Neue"; letter-spacing: 0.12em; } .slot2 .meta { margin-top: 5px; font-size: 12px; opacity: 0.7; letter-spacing: 0.06em; }
.slot2 .prog { margin-top: 9px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); overflow: hidden; } .slot2 .prog i { display: block; height: 100%; background: linear-gradient(90deg, #b49a5e, #ecd49a); }
.slot2 .badge { position: absolute; right: 16px; top: 14px; font: 700 9px/1 "Helvetica Neue"; letter-spacing: 0.2em; padding: 4px 7px; border-radius: 3px; background: #c9b27a; color: #1f1a10; }
.setrow { display: grid; grid-template-columns: 1fr 230px; align-items: center; padding: 9px 14px; border-radius: 8px; font-size: 14px; letter-spacing: 0.06em; cursor: pointer; }
.setrow.sel { background: rgba(232,207,148,0.1); box-shadow: inset 0 0 0 1px rgba(232,207,148,0.5); }
.setrow .v { text-align: right; font-weight: 600; letter-spacing: 0.1em; } .setrow .v::before { content: '‹  '; opacity: 0.45; } .setrow .v::after { content: '  ›'; opacity: 0.45; }
.setrow .help { grid-column: 1 / 3; font-size: 11px; opacity: 0.55; margin-top: 3px; letter-spacing: 0.04em; }
.sethead { margin: 16px 14px 6px; font-size: 10px; letter-spacing: 0.32em; opacity: 0.55; }
#deathScr .panelM h1 { letter-spacing: 0.32em; font-size: 40px; } #deathScr .why { margin: 0 0 8px; font: italic 300 17px/1.4 Georgia, serif; opacity: 0.85; } #deathScr .stat { margin: 0 0 30px; font-size: 11px; letter-spacing: 0.2em; opacity: 0.55; }
#notesScr .paper { position: absolute; right: 8vw; top: 50%; transform: translateY(-50%) rotate(1deg); width: min(520px, 42vw); min-height: 420px; padding: 38px 44px; background: url(${paper}) center/cover; color: #2a2216; box-shadow: 0 30px 70px rgba(0,0,0,0.7); font: 19px/1.55 "Bradley Hand", "Marker Felt", "Chalkboard SE", cursive; white-space: pre-wrap; }
#notesScr .paper h3 { margin: 0 0 16px; font: 600 12px/1 "Helvetica Neue"; letter-spacing: 0.3em; color: #5a4a30; }
#title.menuMode .keys, #title.menuMode #lb, #title.menuMode #loading { display: none; }
#title.menuMode { cursor: default; }
#titleMenu .foothint { position: fixed; }
#titleMenu .ctl { display: grid; grid-template-columns: auto auto; gap: 7px 26px; font-size: 13px; letter-spacing: 0.06em; opacity: 0.85; } #titleMenu .ctl b { text-align: right; font-weight: 600; }
#mapScr { background: rgba(6,6,5,0.8); backdrop-filter: blur(4px); }
#mapScr .mapWrap { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%) rotate(-0.5deg); width: min(1500px, 92vw); aspect-ratio: 1600 / 720; background: url(${paper}) center/cover; box-shadow: 0 30px 80px rgba(0,0,0,0.75), inset 0 0 60px rgba(90,60,20,0.35); border-radius: 3px; }
#mapScr canvas { width: 100%; height: 100%; display: block; }
#mapScr .mapHead { position: absolute; left: 50%; top: 4vh; transform: translateX(-50%); display: flex; gap: 26px; align-items: baseline; font-size: 11px; letter-spacing: 0.25em; white-space: nowrap; }
#mapScr .mapHead b { font-weight: 300; font-size: 26px; letter-spacing: 0.5em; } #mapScr .mapHead .obj { color: #f0b0a0; }
#saveIco { position: fixed; right: 26px; top: 24px; z-index: 5; font-size: 10px; letter-spacing: 0.25em; opacity: 0; transition: opacity 0.6s; color: #efe6d2; text-shadow: 0 1px 4px #000; }
#saveIco::before { content: ''; display: inline-block; width: 9px; height: 9px; margin-right: 8px; border: 2px solid #e8cf94; border-top-color: transparent; border-radius: 50%; vertical-align: -1px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
#fpsC { position: fixed; right: 12px; bottom: 8px; z-index: 5; font: 11px monospace; opacity: 0.6; display: none; }
#guide { position: fixed; left: 0; top: 0; z-index: 4; pointer-events: none; opacity: 0; transition: opacity 1.2s; transform: translate(-50%, -50%); text-align: center; color: #f0e2bc; text-shadow: 0 1px 4px #000; }
#guide .d { width: 12px; height: 12px; margin: 0 auto 4px; border: 2px solid rgba(240,226,188,0.9); transform: rotate(45deg); box-shadow: 0 0 8px rgba(0,0,0,0.6); }
#guide .t { font-size: 10px; letter-spacing: 0.2em; }
`;

export function createUI(ctx) {
  const fab = fabricURL(), fabDark = fabricURL([34, 31, 25], 256, 256), leather = leatherURL(), paper = paperURL();
  const st = document.createElement('style'); st.textContent = CSS(fab, fabDark, leather, paper); document.head.appendChild(st);
  for (const id of ['packScr', 'pauseScr', 'setScr', 'deathScr', 'notesScr', 'benchScr', 'mapScr']) { const d = el('div', 'scr'); d.id = id; document.body.appendChild(d); }
  document.body.appendChild(Object.assign(el('div', '', 'CHECKPOINT · SAVING'), { id: 'saveIco' }));
  document.body.appendChild(Object.assign(el('div'), { id: 'fpsC' }));
  document.body.appendChild(Object.assign(el('div', '', '<div class="d"></div><div class="t"></div>'), { id: 'guide' }));

  const U = { open: null, stack: [] };
  const tick = () => ctx.audio?.uiTick?.();
  const show = (id) => { for (const s of document.querySelectorAll('.scr')) s.classList.toggle('on', s.id === id); };
  const hideAll = () => { for (const s of document.querySelectorAll('.scr')) s.classList.remove('on'); U.open = null; };

  // ======================================================================= BACKPACK
  const pack = { r: 0, c: 0, rows: [] };
  function slotsModel() {
    const P = ctx.P, it = P.items, M = ctx.MELEE;
    const mel = P.melee ? P.melee.id : 'knife';
    const rows = [
      { label: 'Weapons', s: [
        { k: 'pistol', n: `${P.ammo}<small>/${P.spare}</small>`, eq: P.weapon === 'pistol', act: 'equip' },
        { k: mel, n: P.melee ? '' : '∞', bar: P.melee ? P.melee.dur / M[P.melee.id].dur : null, eq: true, act: P.melee ? 'drop' : null },
        { k: 'bottle', n: it.bottle, eq: P.weapon === 'throw' && (P.throwPref || 'bottle') === 'bottle', act: 'equip' },
        { k: 'brick', n: it.brick, eq: P.weapon === 'throw' && P.throwPref === 'brick', act: 'equip' },
        { k: 'molotov', n: it.molotov, eq: P.weapon === 'molotov', act: 'equip' },
      ] },
      { label: 'Supplies', s: [
        { k: 'kit', n: it.kit, act: 'use' }, { k: 'shiv', n: it.shiv }, { k: 'ammo', n: P.spare, act: 'reload' },
        ...(ctx.flags().escape ? [{ k: 'med', n: 1 }] : []),
      ] },
      { label: 'Materials', s: [{ k: 'cloth', n: it.cloth }, { k: 'alcohol', n: it.alcohol }, { k: 'blade', n: it.blade }, { k: 'binding', n: it.binding }, { k: 'scrap', n: it.scrap || 0 }] },
      { label: 'Craft', s: ctx.RECIPES.map(r => ({ k: r.id === 'repair' ? 'binding' : r.id, recipe: r, n: r.id === 'repair' ? '' : it[r.id] })) },
      { label: 'Journal', s: [{ k: 'notes', n: ctx.notes().length, act: 'read' }, { k: 'map', n: '', act: 'map' }] },
    ];
    return rows;
  }
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const icon = (k) => ctx.icons[k] || BLANK;
  let packSig = '';
  function rowsHTML() {
    const rows = pack.rows = slotsModel(); pack.r = Math.min(pack.r, rows.length - 1); pack.c = Math.min(pack.c, rows[pack.r].s.length - 1);
    const craft = ctx.craftProgress();
    let h = '';
    rows.forEach((row, ri) => {
      h += `<div class="row"><label>${row.label}</label><div class="pks">`;
      row.s.forEach((s, ci) => {
        const isRec = !!s.recipe;
        const empty = !isRec && (s.n === 0 || s.n === '0'); const ok = isRec && ctx.canCraft(s.recipe);
        const busy = isRec && craft && craft.id === s.recipe.id;
        const cls = ['pk', empty ? 'empty' : '', ok ? 'ready' : '', isRec && !ok && !busy ? 'empty' : '', busy ? 'busy' : ''].join(' ');
        h += `<div class="${cls}" data-r="${ri}" data-c="${ci}" style="--k:${busy ? craft.k : 0}"><img src="${icon(s.k)}" alt="">${s.eq && !isRec ? '<span class="tag">EQUIPPED</span>' : ''}${isRec ? `<span class="tag">${s.recipe.id === 'repair' ? 'REPAIR' : 'CRAFT'}</span>` : ''}${s.n !== '' && s.n !== undefined ? `<span class="n">${s.n}</span>` : ''}${s.bar != null ? `<span class="bar"><i style="width:${Math.round(s.bar * 100)}%"></i></span>` : ''}</div>`;
      });
      h += `</div></div>`;
    });
    return h;
  }
  function sigOf() { const c = ctx.craftProgress(); return JSON.stringify(slotsModel().map(r => r.s.map(s => [s.k, s.n, !!s.eq, s.bar, s.recipe ? ctx.canCraft(s.recipe) : 0]))) + (c ? c.id : ''); }
  function pips(v) { let s = '<span class="pips">'; for (let i = 0; i < 5; i++) s += `<i class="${i < v ? 'on' : ''}"></i>`; return s + '</span>'; }
  function detailHTML(s) {
    if (!s) return '';
    const I = ctx.ITEMS, P = ctx.P, M = ctx.MELEE;
    if (s.recipe) {
      const r = s.recipe; const ok = ctx.canCraft(r); const name = r.id === 'repair' ? 'Repair melee (+3)' : I[r.id]?.name;
      const need = Object.entries(r.need).map(([k, n]) => `<span><img src="${icon(k)}"><b class="${P.items[k] >= n ? 'ok' : 'no'}">${P.items[k]}/${n}</b> ${I[k].name}</span>`).join('');
      const why = ok ? '' : r.id === 'repair' && !P.melee ? 'No melee weapon to repair.' : r.id === 'repair' && P.melee && P.melee.dur >= M[P.melee.id].dur ? 'Already in good shape.' : r.id !== 'repair' && P.items[r.id] >= r.max ? `You can't carry more than ${r.max}.` : 'Missing materials.';
      const desc = r.id === 'repair' ? 'Wrap the grip and splint the cracks. +3 durability to your melee weapon.' : I[r.id].desc;
      return `<img class="big" src="${icon(s.k)}"><div><span class="tape">${name}</span><div class="cat">Craft · ${r.t.toFixed(1)}s</div><p class="desc">${desc}</p><div class="need">${need}</div><div class="acts">${ok ? '<span><span class="kc">ENTER</span>CRAFT</span>' : `<span class="dim">${why}</span>`}</div></div>`;
    }
    const meta = I[s.k] || { name: s.k, cat: '', desc: '' };
    let stats = '';
    const mw = M[s.k];
    if (mw) stats = `<div class="stats"><span>DAMAGE</span>${pips(mw.dmg + 1)}<span>SPEED</span>${pips(Math.round(6 - mw.swing * 5))}<span>REACH</span>${pips(Math.round((mw.reach - 1.4) * 5))}<span>NOISE</span>${pips(Math.round(mw.noise / 1.4))}<span>CONDITION</span><span>${P.melee ? `${P.melee.dur} / ${mw.dur}` : ''}</span></div>`;
    if (s.k === 'pistol') stats = `<div class="stats"><span>LOADED</span><span>${P.ammo} / ${P.magSize || 6}</span><span>SPARE</span><span>${P.spare}</span><span>UPGRADES</span><span>${(P.upgrades || []).map(u => u.replace(/_/g, ' ')).join(', ') || 'none'}</span></div>`;
    const actions = { equip: 'EQUIP', use: 'USE', reload: 'RELOAD', drop: 'DROP', read: 'READ', map: 'OPEN MAP' };
    const can = s.act && !(s.n === 0 && (s.act === 'equip' || s.act === 'use' || s.act === 'reload'));
    const acts = s.act ? `<span class="${can ? '' : 'dim'}"><span class="kc">${s.act === 'drop' ? 'X' : 'ENTER'}</span>${actions[s.act]}</span>` : '';
    return `<img class="big" src="${icon(s.k)}"><div><span class="tape">${meta.name}</span><div class="cat">${meta.cat}${typeof s.n === 'number' ? ' · ' + s.n + ' carried' : ''}</div><p class="desc">${meta.desc}</p>${stats}<div class="acts">${acts}</div></div>`;
  }
  function buildPack() {
    $('packScr').innerHTML = `<div class="shade"></div><div class="bag"><div class="head"><h2>WREN'S PACK</h2><span class="hint"><span class="kc">←↑↓→</span>select <span class="kc">ENTER</span>use <span class="kc">TAB</span>close</span></div><div class="body"><div class="rows"></div><div class="det"></div><div class="foot"><span class="hp"></span><span class="obj"></span></div></div></div>`;
    refreshRows();
  }
  function refreshRows() {
    const box = $('packScr').querySelector('.rows'); if (!box) return;
    box.innerHTML = rowsHTML(); packSig = sigOf();
    for (const p of box.querySelectorAll('.pk')) {
      p.onmouseenter = () => { const r = +p.dataset.r, c = +p.dataset.c; if (r !== pack.r || c !== pack.c) { pack.r = r; pack.c = c; updateSel(); } };
      p.onclick = () => { pack.r = +p.dataset.r; pack.c = +p.dataset.c; updateSel(); packAction('enter'); };
    }
    updateSel();
  }
  function updateSel() {
    const d = $('packScr'); if (!d.querySelector('.det')) return;
    for (const p of d.querySelectorAll('.pk')) p.classList.toggle('sel', +p.dataset.r === pack.r && +p.dataset.c === pack.c);
    d.querySelector('.det').innerHTML = detailHTML(pack.rows[pack.r]?.s[pack.c]);
    d.querySelector('.foot .hp').textContent = `HEALTH ${Math.round(ctx.P.hp)}%`;
    d.querySelector('.foot .obj').textContent = ctx.objectiveText();
  }
  function tickPack() { // the game calls this ~8x/s while the pack is open: rebuild only when contents change
    if (U.open !== 'pack') return;
    if (sigOf() !== packSig) { refreshRows(); return; }
    const c = ctx.craftProgress(); const d = $('packScr');
    for (const p of d.querySelectorAll('.pk.busy')) p.style.setProperty('--k', c ? c.k : 0);
    const hp = d.querySelector('.foot .hp'); if (hp) hp.textContent = `HEALTH ${Math.round(ctx.P.hp)}%`;
  }
  function packAction(kind) {
    const s = pack.rows[pack.r]?.s[pack.c]; if (!s) return;
    if (s.recipe) { if (kind === 'enter') ctx.startCraft(s.recipe); }
    else if (kind === 'drop' && s.act === 'drop') ctx.dropMelee();
    else if (kind === 'enter') {
      if (s.act === 'equip') ctx.equip(s.k);
      else if (s.act === 'use') { if (ctx.useKit()) { closePack(); return; } }
      else if (s.act === 'reload') ctx.reload();
      else if (s.act === 'read') { openNotes('pack'); return; }
      else if (s.act === 'map') { closePack(); ctx.openMap(); return; }
    }
    tickPack();
  }
  function openPack() { pack.r = Math.min(pack.r, 4); U.open = 'pack'; show('packScr'); buildPack(); ctx.audio?.zip?.(); }
  function closePack() { if (U.open === 'pack') { hideAll(); ctx.onPackClosed?.(); } }
  U.openPack = openPack; U.closePack = closePack; U.refreshPack = tickPack;

  // ======================================================================= NOTES
  const notesSt = { i: 0, from: 'pack' };
  function openNotes(from = 'pack', focusId) {
    notesSt.from = from; const ns = ctx.notes(); if (focusId) { const k = ns.findIndex(n => n.id === focusId); if (k >= 0) notesSt.i = k; }
    U.open = 'notes'; show('notesScr'); renderNotes(); ctx.audio?.paper?.();
  }
  function closeNotes() { hideAll(); const f = notesSt.from; if (f === 'pause') openPause(); else if (f === 'pack') openPack(); else ctx.onPause?.(false); }
  function renderNotes() {
    const ns = ctx.notes(); const d = $('notesScr');
    if (!ns.length) { d.innerHTML = `<div class="panelM"><h1 style="font-size:30px;letter-spacing:.3em">NOTES</h1><p class="sub">NOTHING FOUND YET</p></div><div class="foothint"><span class="kc">ESC</span>back</div>`; return; }
    notesSt.i = Math.min(notesSt.i, ns.length - 1); const n = ns[notesSt.i];
    d.innerHTML = `<div class="panelM"><h1 style="font-size:30px;letter-spacing:.3em">NOTES</h1><p class="sub">${ns.length} FOUND</p><ul class="menu">${ns.map((x, i) => `<li class="${i === notesSt.i ? 'sel' : ''}" data-i="${i}" style="font-size:16px">${x.title}<small>${x.where}</small></li>`).join('')}</ul></div><div class="paper"><h3>${n.where.toUpperCase()}</h3>${n.text}</div><div class="foothint"><span class="kc">↑↓</span>choose <span class="kc">ESC</span>${notesSt.from === 'game' ? 'back to the game' : 'back'}</div>`;
    for (const li of d.querySelectorAll('li')) li.onclick = () => { notesSt.i = +li.dataset.i; renderNotes(); };
  }
  U.openNotes = openNotes;

  // ======================================================================= generic list menu helper
  function listMenu(container, items, sel, onPick) {
    const lis = container.querySelectorAll('li[data-i]');
    lis.forEach(li => {
      li.onmouseenter = () => { const i = +li.dataset.i; if (i === sel.i) return; sel.i = i; lis.forEach(x => x.classList.toggle('sel', +x.dataset.i === i)); onPick('hover'); };
      li.onclick = () => { sel.i = +li.dataset.i; onPick('enter'); };
    });
  }

  // ======================================================================= PAUSE
  const pause = { i: 0 };
  const PAUSE_ITEMS = [['Resume', 'resume'], ['Backpack', 'pack'], ['Map', 'map'], ['Notes', 'notes'], ['Settings', 'settings'], ['Restart from checkpoint', 'retry'], ['Quit to title', 'title']];
  function openPause() { U.open = 'pause'; show('pauseScr'); renderPause(); ctx.onPause?.(true); }
  function renderPause() {
    const d = $('pauseScr'); const cp = ctx.checkpointInfo();
    d.innerHTML = `<div class="panelM"><h1 style="font-size:34px">PAUSED</h1><p class="sub">${cp.area.toUpperCase()} · ${cp.progress}% · ${S.fmtTime(cp.playtime)}</p><ul class="menu">${PAUSE_ITEMS.map(([t], i) => `<li data-i="${i}" class="${i === pause.i ? 'sel' : ''}">${t}${i === 5 ? `<small>Last checkpoint: ${cp.name} · ${S.fmtAgo(cp.at)}</small>` : ''}</li>`).join('')}</ul></div><div class="foothint"><span class="kc">↑↓</span>select <span class="kc">ENTER</span>confirm <span class="kc">ESC</span>resume</div>`;
    listMenu(d, PAUSE_ITEMS, pause, (k) => { if (k === 'enter') pausePick(); else tick(); });
  }
  function pausePick() {
    const a = PAUSE_ITEMS[pause.i][1];
    if (a === 'resume') { hideAll(); ctx.onPause?.(false); }
    else if (a === 'pack') { hideAll(); ctx.onPause?.(false); ctx.openPackFromMenu(); }
    else if (a === 'map') openMap('pause');
    else if (a === 'notes') openNotes('pause');
    else if (a === 'settings') { openSettings('pause'); }
    else if (a === 'retry') { hideAll(); ctx.onPause?.(false); ctx.onRetry(); }
    else if (a === 'title') { hideAll(); ctx.onQuitToTitle(); }
  }
  U.openPause = openPause;

  // ======================================================================= SETTINGS
  const setSt = { i: 0, from: null };
  const SET_ROWS = [
    ['GAMEPLAY'],
    ['guidance', 'Objective nudges', ['off', 'delayed', 'always'], { off: 'Off', delayed: 'After 60s stuck', always: 'Always' }, 'A faint marker toward the objective if you seem lost. Wren may also mutter a hint.'],
    ['subtitles', 'Subtitles', [true, false]], ['voice', 'Wren\'s voice', [true, false]],
    ['CONTROLS'],
    ['sens', 'Look sensitivity', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ['invertY', 'Invert look Y', [false, true]], ['keyLook', 'Arrow keys turn camera', [true, false], null, 'Play without a mouse: arrows look around, WASD moves.'],
    ['AUDIO'],
    ['master', 'Master volume', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ['effects', 'Effects', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ['music', 'Music', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]], ['voiceVol', 'Voice', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    ['VIDEO'],
    ['quality', 'Graphics', ['auto', 'low', 'medium', 'high', 'ultra'], { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' }, 'Auto lowers effects if the frame rate drops. Any other choice is fixed.'],
    ['shake', 'Camera shake', ['full', 'reduced', 'off'], { full: 'Full', reduced: 'Reduced', off: 'Off' }], ['fps', 'Show FPS', [false, true]],
  ];
  const selectable = () => SET_ROWS.map((r, i) => r.length > 1 ? i : -1).filter(i => i >= 0);
  function openSettings(from) { setSt.from = from; U.open = 'settings'; show('setScr'); if (!SET_ROWS[setSt.i] || SET_ROWS[setSt.i].length === 1) setSt.i = selectable()[0]; renderSettings(); }
  function fmtVal(row, v) { if (row[3] && row[3][v] !== undefined) return row[3][v]; if (v === true) return 'On'; if (v === false) return 'Off'; return String(v); }
  function renderSettings() {
    const s = ctx.settings; const d = $('setScr');
    let h = `<div class="panelM" style="max-width:640px;width:44vw"><h1 style="font-size:30px;letter-spacing:.35em">SETTINGS</h1><div style="max-height:68vh;overflow:auto;margin-top:18px">`;
    SET_ROWS.forEach((r, i) => { if (r.length === 1) { h += `<div class="sethead">${r[0]}</div>`; return; } h += `<div class="setrow ${i === setSt.i ? 'sel' : ''}" data-i="${i}"><span>${r[1]}</span><span class="v">${fmtVal(r, s[r[0]])}</span>${r[4] && i === setSt.i ? `<span class="help">${r[4]}</span>` : ''}</div>`; });
    h += `</div></div><div class="foothint"><span class="kc">↑↓</span>select <span class="kc">←→</span>change <span class="kc">ESC</span>back · saved automatically${S.storageOK ? '' : ' (this session only — browser storage blocked)'}</div>`;
    d.innerHTML = h;
    d.querySelectorAll('.setrow').forEach(rw => { rw.onclick = () => { setSt.i = +rw.dataset.i; changeSetting(1); }; });
  }
  function changeSetting(dir) {
    const r = SET_ROWS[setSt.i]; if (!r || r.length === 1) return; const opts = r[2]; const s = ctx.settings;
    let k = opts.indexOf(s[r[0]]); if (k < 0) k = 0; k = (k + dir + opts.length) % opts.length; s[r[0]] = opts[k];
    S.saveSettings(s); ctx.applySettings(s); tick(); renderSettings();
  }
  function closeSettings() { const from = setSt.from; hideAll(); if (from === 'pause') openPause(); else if (from === 'title') showTitle(); }
  U.openSettings = openSettings;

  // ======================================================================= DEATH
  const death = { i: 0, info: null };
  const DEATH_ITEMS = [['Retry from checkpoint', 'retry'], ['Load another game', 'load'], ['Quit to title', 'title']];
  function openDeath(info) { death.info = info; death.i = 0; U.open = 'death'; show('deathScr'); renderDeath(); }
  function renderDeath() {
    const i = death.info || {}; const d = $('deathScr');
    d.innerHTML = `<div class="panelM"><h1>${i.title || 'YOU DIED'}</h1><p class="why">${i.why || ''}</p><p class="stat">LAST CHECKPOINT · ${String(i.checkpoint || '').toUpperCase()} · ${S.fmtAgo(i.at || Date.now())}${i.deaths ? ` · DEATHS ${i.deaths}` : ''}</p><ul class="menu">${DEATH_ITEMS.map(([t], k) => `<li data-i="${k}" class="${k === death.i ? 'sel' : ''}">${t}</li>`).join('')}</ul></div><div class="foothint"><span class="kc">↑↓</span>select <span class="kc">ENTER</span>confirm · <span class="kc">R</span>quick retry</div>`;
    listMenu(d, DEATH_ITEMS, death, (k) => { if (k === 'enter') deathPick(); else tick(); });
  }
  function deathPick() { const a = DEATH_ITEMS[death.i][1]; hideAll(); if (a === 'retry') ctx.onRetry(); else if (a === 'load') ctx.showTitle('load'); else ctx.onQuitToTitle(); }
  U.openDeath = openDeath;

  // ======================================================================= TITLE MENU (lives inside #title)
  const title = { view: 'main', i: 0, li: 0, confirm: null };
  function titleItems() {
    const slots = S.loadSlots().sort((a, b) => b.updated - a.updated); const last = slots.find(s => s.id === S.getMeta().lastSlot) || slots[0];
    const items = [];
    if (last) items.push(['continue', 'Continue', `${last.name} · ${last.completed ? 'Completed ✓' : last.area} · ${last.progress}% · ${S.fmtTime(last.playtime)}${last.cycle ? ' · New Story+' : ''}`]);
    if (last && last.completed) items.push(['ngplus', 'New Story+', `Replay ${last.name} with your weapons — new notes, harder infected, and a friend who walked this way before you.`]);
    items.push(['new', '+ New Game', last ? 'Start a fresh save. Your other games stay.' : 'Rain. A pharmacy. Something growing inside.']);
    if (slots.length) items.push(['load', 'Load Game', `${slots.length} save${slots.length > 1 ? 's' : ''}`]);
    items.push(['settings', 'Settings', ''], ['controls', 'Controls', ''], ['trailer', 'Watch Trailer', ''], ['credits', 'Credits', '']);
    return { items, slots, last };
  }
  function renderTitle() {
    const t = $('titleMenu'); const { items, slots } = titleItems();
    if (title.view === 'main') {
      title.i = Math.min(title.i, items.length - 1);
      t.innerHTML = `<ul class="menu">${items.map(([, l, sub], i) => `<li data-i="${i}" class="${i === title.i ? 'sel' : ''}">${l}${sub ? `<small>${sub}</small>` : ''}</li>`).join('')}</ul><div class="foothint"><span class="kc">↑↓</span>select <span class="kc">ENTER</span>confirm · headphones recommended<br><a href="https://suno.com/song/21244337-5081-4da5-8078-93e05dfb09ea" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:12px;color:#e8cf94;text-transform:none;letter-spacing:.06em">Listen to Waiting in the Dark on Suno ↗</a></div>`;
      listMenu(t, items, title, (k) => { if (k === 'enter') titlePick(); else tick(); });
    } else if (title.view === 'load') {
      title.li = Math.min(title.li, Math.max(0, slots.length - 1));
      const conf = title.confirm;
      t.innerHTML = `<div style="width:min(560px,46vw)"><div class="sethead" style="margin-left:0">LOAD GAME</div><div class="slots">${slots.map((s, i) => `<div class="slot2 ${i === title.li ? 'sel' : ''}" data-i="${i}">${s.completed ? `<span class="badge">COMPLETED</span>` : s.cycle ? `<span class="badge">NEW STORY+</span>` : ''}<b>${s.name}</b><div class="meta">${s.completed ? 'Finished' : s.area} · ${s.checkpoint} · ${S.fmtTime(s.playtime)} · ${S.fmtAgo(s.updated)}${s.cycle ? ` · Story ${s.cycle + 1}` : ''}</div><div class="prog"><i style="width:${s.progress}%"></i></div><div class="meta">${s.progress}% complete${s.completed ? ' · <b style="font-size:12px">N</b> New Story+ — keep your weapons, new notes, a friend\'s trail' : ''}</div></div>`).join('') || '<p class="sub">NO SAVES</p>'}</div>${conf ? `<p class="sub" style="color:#f0a090;margin-top:14px">DELETE "${conf.name}"? ENTER TO CONFIRM · ESC TO CANCEL</p>` : ''}</div><div class="foothint"><span class="kc">↑↓</span>select <span class="kc">ENTER</span>load <span class="kc">N</span>New Story+ <span class="kc">X</span>delete <span class="kc">ESC</span>back</div>`;
      const els = t.querySelectorAll('.slot2');
      els.forEach(sl => { sl.onmouseenter = () => { const i = +sl.dataset.i; if (i === title.li) return; title.li = i; els.forEach(x => x.classList.toggle('sel', +x.dataset.i === i)); }; sl.onclick = () => { title.li = +sl.dataset.i; loadPick('enter'); }; });
    } else if (title.view === 'controls') {
      t.innerHTML = `<div class="sethead" style="margin-left:0">CONTROLS</div><div class="ctl">${CONTROLS.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('')}</div><div class="foothint"><span class="kc">ESC</span>back</div>`;
    } else if (title.view === 'credits') {
      t.innerHTML = `<div class="sethead" style="margin-left:0">CREDITS</div><p class="sub" style="line-height:2.2;letter-spacing:.18em;opacity:.7">${ctx.creditsHTML}</p><div class="foothint"><span class="kc">ESC</span>back</div>`;
    }
  }
  const CONTROLS = [['WASD', 'move'], ['ARROW KEYS', 'look around (no mouse needed)'], ['SHIFT', 'run'], ['C', 'crouch — quiet'], ['Z / RIGHT MOUSE', 'aim'], ['LEFT MOUSE / ENTER (aiming)', 'fire · throw'], ['F', 'melee · takedown · struggle'], ['G', 'throw bottle / brick'], ['R', 'reload'], ['H', 'use health kit'], ['TAB', 'backpack — arrows + Enter'], ['M', 'map'], ['1 / 2 / 3', 'pistol · throwable · molotov'], ['SPACE', 'dodge'], ['E', 'interact / pick up'], ['HOLD Q', 'listen'], ['L', 'flashlight'], ['X', 'swap shoulder'], ['ESC / P', 'pause']];
  function leaveTitle() { U.open = null; $('title').style.display = 'none'; }
  function titlePick() {
    const { items, last } = titleItems(); const a = items[title.i]?.[0]; tick();
    if (a === 'continue') { leaveTitle(); ctx.onContinue(last); }
    else if (a === 'new') { leaveTitle(); ctx.onNewGame(); }
    else if (a === 'load') { title.view = 'load'; title.li = 0; renderTitle(); }
    else if (a === 'settings') { $('title').style.display = 'none'; openSettings('title'); }
    else if (a === 'controls') { title.view = 'controls'; renderTitle(); }
    else if (a === 'ngplus') { leaveTitle(); ctx.onNewStoryPlus(last); }
    else if (a === 'trailer') { leaveTitle(); ctx.onTrailer(); }
    else if (a === 'credits') { title.view = 'credits'; renderTitle(); }
  }
  function loadPick(k) {
    const { slots } = titleItems(); const s = slots[title.li]; if (!s) return;
    if (title.confirm) { if (k === 'enter') { S.deleteSlot(title.confirm.id); title.confirm = null; tick(); } renderTitle(); return; }
    if (k === 'enter') { leaveTitle(); ctx.onContinue(s); }
    else if (k === 'ng+' && s.completed) { leaveTitle(); ctx.onNewStoryPlus(s); }
    else if (k === 'delete') { title.confirm = s; renderTitle(); }
  }
  function showTitle(view = 'main') { hideAll(); title.view = view; title.confirm = null; U.open = 'title'; const t = $('title'); t.style.display = 'flex'; t.classList.add('menuMode'); renderTitle(); }
  U.showTitle = showTitle;

  // ======================================================================= WORKBENCH
  const bench = { i: 0 };
  function openBench() { U.open = 'bench'; show('benchScr'); renderBench(); }
  function renderBench() {
    const opts = ctx.benchOptions(); bench.i = Math.min(bench.i, opts.length - 1); const d = $('benchScr'); const o = opts[bench.i];
    d.innerHTML = `<div class="panelM" style="width:min(560px,46vw)"><h1 style="font-size:30px;letter-spacing:.32em">WORKBENCH</h1><p class="sub">SCRAP ${ctx.P.items.scrap || 0} · BINDING ${ctx.P.items.binding}</p><ul class="menu">${opts.map((x, i) => `<li data-i="${i}" class="${i === bench.i ? 'sel' : ''} ${x.can ? '' : 'off'}" style="font-size:17px">${x.name}${x.done ? ' ✓' : ''}<small>${x.desc} · ${x.costText}</small></li>`).join('')}</ul></div>${o ? `<div class="paper" style="position:absolute;right:8vw;top:50%;transform:translateY(-50%);width:min(380px,30vw);padding:28px;background:url(${paper}) center/cover;color:#2a2216;box-shadow:0 30px 70px rgba(0,0,0,.7)"><img src="${icon(o.icon)}" style="width:100%;max-height:200px;object-fit:contain;filter:drop-shadow(0 10px 8px rgba(0,0,0,.4))"><div style="font:22px 'Marker Felt','Bradley Hand',cursive;margin-top:10px">${o.name}</div><div style="font-size:13px;margin-top:6px;line-height:1.5">${o.long || o.desc}</div></div>` : ''}<div class="foothint"><span class="kc">↑↓</span>select <span class="kc">ENTER</span>build <span class="kc">ESC</span>leave</div>`;
    listMenu(d, opts, bench, (k) => { if (k === 'enter') ctx.benchBuild(opts[bench.i]); renderBench(); });
  }
  U.openBench = openBench;

  // ======================================================================= MAP
  let mapRAF = 0, mapFrom = 'game';
  function openMap(from = 'game') {
    mapFrom = from; U.open = 'map'; show('mapScr'); const info = ctx.mapInfo();
    $('mapScr').innerHTML = `<div class="mapWrap"><canvas width="1600" height="720"></canvas></div><div class="mapHead"><b>MAP</b><span>${info.area}</span><span>${info.explored}% EXPLORED</span>${info.objective ? `<span class="obj">◎ ${info.objective}</span>` : ''}</div><div class="foothint"><span class="kc">M</span><span class="kc">ESC</span>close</div>`;
    const cv = $('mapScr').querySelector('canvas');
    const loop = () => { if (U.open !== 'map') return; ctx.drawMap(cv); mapRAF = requestAnimationFrame(loop); }; loop();
    ctx.audio?.paper?.();
  }
  function closeMap() { cancelAnimationFrame(mapRAF); hideAll(); if (mapFrom === 'pause') openPause(); else ctx.onMapClosed?.(); }
  U.openMap = openMap;

  // ======================================================================= keyboard routing
  const isUp = (c) => c === 'ArrowUp' || c === 'KeyW', isDown = (c) => c === 'ArrowDown' || c === 'KeyS', isLeft = (c) => c === 'ArrowLeft' || c === 'KeyA', isRight = (c) => c === 'ArrowRight' || c === 'KeyD';
  const isEnter = (c) => c === 'Enter' || c === 'Space' || c === 'NumpadEnter' || c === 'KeyE';
  const isBack = (c) => c === 'Escape' || c === 'Backspace';
  U.handleKey = (e) => {
    const c = e.code; const o = U.open; if (!o) return false;
    if (o === 'pack') {
      if (c === 'Tab' || c === 'KeyI' || isBack(c)) { closePack(); return true; }
      const rows = pack.rows;
      if (isUp(c)) { pack.r = (pack.r - 1 + rows.length) % rows.length; pack.c = Math.min(pack.c, rows[pack.r].s.length - 1); tick(); updateSel(); }
      else if (isDown(c)) { pack.r = (pack.r + 1) % rows.length; pack.c = Math.min(pack.c, rows[pack.r].s.length - 1); tick(); updateSel(); }
      else if (isLeft(c)) { pack.c = (pack.c - 1 + rows[pack.r].s.length) % rows[pack.r].s.length; tick(); updateSel(); }
      else if (isRight(c)) { pack.c = (pack.c + 1) % rows[pack.r].s.length; tick(); updateSel(); }
      else if (isEnter(c)) packAction('enter');
      else if (c === 'KeyX' || c === 'Delete') packAction('drop');
      else if (c === 'KeyM') { closePack(); ctx.openMap(); }
      return true;
    }
    if (o === 'notes') { const ns = ctx.notes(); if (isUp(c)) { notesSt.i = Math.max(0, notesSt.i - 1); renderNotes(); } else if (isDown(c)) { notesSt.i = Math.min(ns.length - 1, notesSt.i + 1); renderNotes(); } else if (isBack(c) || c === 'Tab' || isEnter(c)) closeNotes(); return true; }
    if (o === 'map') { if (isBack(c) || c === 'KeyM' || c === 'Tab' || isEnter(c)) closeMap(); return true; }
    if (o === 'pause') { if (isUp(c)) { pause.i = (pause.i - 1 + PAUSE_ITEMS.length) % PAUSE_ITEMS.length; tick(); renderPause(); } else if (isDown(c)) { pause.i = (pause.i + 1) % PAUSE_ITEMS.length; tick(); renderPause(); } else if (isEnter(c)) pausePick(); else if (isBack(c) || c === 'KeyP') { hideAll(); ctx.onPause?.(false); } return true; }
    if (o === 'settings') { const sel = selectable(); const k = sel.indexOf(setSt.i); if (isUp(c)) { setSt.i = sel[(k - 1 + sel.length) % sel.length]; tick(); renderSettings(); } else if (isDown(c)) { setSt.i = sel[(k + 1) % sel.length]; tick(); renderSettings(); } else if (isLeft(c)) changeSetting(-1); else if (isRight(c) || isEnter(c)) changeSetting(1); else if (isBack(c)) closeSettings(); return true; }
    if (o === 'death') { if (isUp(c)) { death.i = (death.i - 1 + DEATH_ITEMS.length) % DEATH_ITEMS.length; tick(); renderDeath(); } else if (isDown(c)) { death.i = (death.i + 1) % DEATH_ITEMS.length; tick(); renderDeath(); } else if (isEnter(c)) deathPick(); else if (c === 'KeyR') { hideAll(); ctx.onRetry(); } return true; }
    if (o === 'bench') { const opts = ctx.benchOptions(); if (isUp(c)) { bench.i = (bench.i - 1 + opts.length) % opts.length; tick(); renderBench(); } else if (isDown(c)) { bench.i = (bench.i + 1) % opts.length; tick(); renderBench(); } else if (isEnter(c)) { ctx.benchBuild(opts[bench.i]); renderBench(); } else if (isBack(c) || c === 'Tab') { hideAll(); ctx.onBenchClosed?.(); } return true; }
    if (o === 'title') {
      if (title.view === 'main') { const n = titleItems().items.length; if (isUp(c)) { title.i = (title.i - 1 + n) % n; tick(); renderTitle(); } else if (isDown(c)) { title.i = (title.i + 1) % n; tick(); renderTitle(); } else if (isEnter(c)) titlePick(); return true; }
      if (title.view === 'load') { const n = titleItems().slots.length; if (isBack(c)) { if (title.confirm) title.confirm = null; else title.view = 'main'; renderTitle(); } else if (isUp(c) && n) { title.li = (title.li - 1 + n) % n; renderTitle(); } else if (isDown(c) && n) { title.li = (title.li + 1) % n; renderTitle(); } else if (isEnter(c)) loadPick('enter'); else if (c === 'KeyN') loadPick('ng+'); else if (c === 'KeyX' || c === 'Delete') loadPick('delete'); return true; }
      if (title.view === 'credits' || title.view === 'controls') { if (isBack(c) || isEnter(c)) { title.view = 'main'; renderTitle(); } return true; }
    }
    return false;
  };

  // ======================================================================= small HUD bits
  let saveT = 0;
  U.flashSave = () => { const s = $('saveIco'); s.style.opacity = 0.85; clearTimeout(saveT); saveT = setTimeout(() => s.style.opacity = 0, 2200); };
  U.setFPS = (on, v) => { const f = $('fpsC'); f.style.display = on ? 'block' : 'none'; if (on && v) f.textContent = `${Math.round(v)} FPS`; };
  U.guide = (vis, x, y, text) => { const g = $('guide'); g.style.opacity = vis ? 0.9 : 0; if (vis) { g.style.left = x + 'px'; g.style.top = y + 'px'; g.querySelector('.t').textContent = text; } };
  U.hideAll = hideAll;
  return U;
}
