// Save slots, settings and meta flags in localStorage, degrading to memory if storage is blocked
// (itch.io runs games in an iframe where some browsers partition or deny storage).
const K_SLOTS = 'atb.saves.v1', K_SET = 'atb.settings.v1', K_META = 'atb.meta.v1';
const mem = {};
let warned = false;
function get(k, fallback) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : (k in mem ? mem[k] : fallback); }
  catch { return k in mem ? mem[k] : fallback; }
}
function put(k, v) {
  mem[k] = v;
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { if (!warned) { warned = true; console.warn('save: storage unavailable, progress lasts this session only', e?.name); } return false; }
}
export const storageOK = (() => { try { localStorage.setItem('atb.t', '1'); localStorage.removeItem('atb.t'); return true; } catch { return false; } })();

export const DEFAULT_SETTINGS = {
  difficulty: 'medium',
  guidance: 'delayed',   // off | delayed | always
  subtitles: true, voice: true,
  master: 9, effects: 8, music: 7, voiceVol: 9,
  sens: 5, invertY: false, keyLook: true,
  quality: 'auto',       // auto | low | medium | high | ultra
  shake: 'full',         // full | reduced | off
  fps: false,
};
export function loadSettings() { return { ...DEFAULT_SETTINGS, ...get(K_SET, {}) }; }
export function saveSettings(s) { put(K_SET, s); }

export function getMeta() { return { trailerSeen: false, lastSlot: null, completedAny: false, ...get(K_META, {}) }; }
export function setMeta(patch) { const m = { ...getMeta(), ...patch }; put(K_META, m); return m; }

export function loadSlots() { const s = get(K_SLOTS, []); return Array.isArray(s) ? s : []; }
export function saveSlots(slots) { put(K_SLOTS, slots); }
export function getSlot(id) { return loadSlots().find(s => s.id === id) || null; }
export function upsertSlot(slot) {
  const all = loadSlots(); const i = all.findIndex(s => s.id === slot.id);
  slot.updated = Date.now(); if (i >= 0) all[i] = slot; else all.push(slot);
  saveSlots(all); setMeta({ lastSlot: slot.id }); return slot;
}
export function deleteSlot(id) { saveSlots(loadSlots().filter(s => s.id !== id)); const m = getMeta(); if (m.lastSlot === id) setMeta({ lastSlot: null }); }
export function newSlot({ cycle = 0, carry = null, name } = {}) {
  const all = loadSlots(); const n = all.length ? Math.max(...all.map(s => s.num || 0)) + 1 : 1;
  return { id: 's' + Date.now().toString(36), num: n, name: name || `Game ${n}`, cycle, carry, created: Date.now(), updated: Date.now(), playtime: 0, progress: 0, area: 'Rainy street', checkpoint: 'Start', completed: false, snap: null };
}
export function fmtTime(sec) { sec = Math.round(sec || 0); const m = Math.floor(sec / 60), s = sec % 60; return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${String(s).padStart(2, '0')}s`; }
export function fmtAgo(ts) { const d = (Date.now() - ts) / 1000; if (d < 90) return 'just now'; if (d < 3600) return `${Math.round(d / 60)} min ago`; if (d < 86400) return `${Math.round(d / 3600)} h ago`; return `${Math.round(d / 86400)} d ago`; }
