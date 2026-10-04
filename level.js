// Level data, tile queries, pathfinding, sight and sound propagation, and world geometry.
import * as THREE from 'three';
import { prop } from './assets.js';

export const CS = 2;            // cell size (m)
export const W = 64, H = 28;    // grid size (cells)
export const WALL_H = 4;

// ---------------------------------------------------------------- map
// '#' wall  '.' concrete  'w' wet concrete  'c' carpet  'g' broken glass  'm' metal grate
// 'f' fungal mat  'k' weak floor  'H' shelf/furniture  'M' machinery  'W' window
// 'D' door  'L' fungal-sealed door  'E' emergency exit  'n' squeeze gap  'O' floor hole
export const grid = [];
for (let z = 0; z < H; z++) grid.push(new Array(W).fill('#'));
const R = (x0, z0, x1, z1, c) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) grid[z][x] = c; };
const S = (x, z, c) => { grid[z][x] = c; };

// AREA 1: rainy street
R(1, 2, 10, 12, 'w');
// AREA 2: pharmacy
R(12, 2, 24, 12, '.');
R(11, 3, 11, 6, 'W'); R(11, 8, 11, 11, 'W'); S(11, 7, 'D');
R(14, 4, 17, 4, 'H'); R(13, 9, 15, 9, 'H'); R(19, 2, 19, 4, 'H'); R(16, 7, 17, 7, 'H');
R(17, 9, 19, 11, 'g'); S(13, 6, 'g'); S(14, 6, 'g');
R(21, 6, 24, 6, '#'); R(21, 7, 21, 12, '#'); S(21, 8, '.'); S(21, 11, '.'); // back storeroom
S(24, 12, 'H');
S(25, 10, 'D');
// AREA 3: service corridor
R(26, 10, 30, 10, 'm'); R(31, 7, 31, 10, '.'); R(31, 7, 36, 7, '.'); R(33, 8, 34, 9, '.');
R(36, 7, 36, 10, 'm'); R(37, 10, 37, 10, '.'); S(38, 10, 'n');
S(31, 8, 'P'); // collapsed floor: bridge it with a plank
// AREA 4: collapsed apartment
R(39, 2, 52, 14, 'c');
R(44, 2, 44, 14, '#'); S(44, 5, 'c'); S(44, 11, 'c');
R(48, 2, 48, 14, '#'); S(48, 3, 'c'); S(48, 9, 'c'); S(48, 13, 'c');
R(39, 8, 43, 8, '#'); S(41, 8, 'c');
R(49, 7, 52, 7, '#'); S(50, 7, 'c');
R(45, 2, 47, 6, '.'); // kitchen
S(40, 4, 'H'); S(46, 10, 'H'); S(51, 4, 'H'); S(42, 12, 'H'); S(47, 12, 'H');
R(45, 8, 45, 8, 'g');
S(52, 13, 'O');
// AREA 5: nest
R(38, 17, 62, 25, '.');
R(40, 20, 60, 22, 'f');
for (let x = 40; x <= 59; x++) { if (x % 4 !== 1) S(x, 19, 'M'); if (x % 5 !== 2) S(x, 23, 'M'); }
for (let z = 17; z <= 25; z++) if (grid[z][47] !== '#') S(47, z, 'k');
for (let x = 41; x <= 59; x += 6) { S(x, 17, 'f'); S(x + 2, 25, 'f'); }
R(60, 17, 60, 25, '#'); S(60, 23, 'S'); S(59, 23, '.'); S(59, 22, '.'); S(59, 24, '.'); // clear approach to the shutter // storeroom wall + rolling shutter (generator powered)
S(58, 25, 'H'); // generator
S(37, 24, 'L');
// AREA 6: escape corridor
R(15, 21, 36, 25, '.');
R(18, 23, 34, 23, '#');
R(24, 21, 26, 22, 'g');
S(22, 24, 'H'); S(26, 25, 'H'); S(30, 24, 'H');
S(14, 23, 'E');
R(2, 20, 13, 25, 'w'); // exterior yard

export const START = { x: 3, z: 7 };
export const NEST_LANDING = { x: 39, z: 21 };

export const AREAS = [
  { id: 'street',    x0: 0,  z0: 0,  x1: 11, z1: 14, outside: true },
  { id: 'pharmacy',  x0: 12, z0: 0,  x1: 25, z1: 14 },
  { id: 'corridor',  x0: 26, z0: 5,  x1: 38, z1: 14 },
  { id: 'apartment', x0: 39, z0: 0,  x1: 63, z1: 15 },
  { id: 'nest',      x0: 37, z0: 16, x1: 63, z1: 27 },
  { id: 'escape',    x0: 14, z0: 16, x1: 36, z1: 27 },
  { id: 'outside',   x0: 0,  z0: 16, x1: 13, z1: 27, outside: true },
];

export const PICKUPS = [
  { id: 'p1', kind: 'bottle',  x: 13, z: 3 },
  { id: 'p2', kind: 'brick',   x: 8,  z: 4 },
  { id: 'p3', kind: 'ammo',    x: 18, z: 10, n: 2 },
  { id: 'p4', kind: 'cloth',   x: 23, z: 11 },
  { id: 'p5', kind: 'bottle',  x: 33, z: 9 },
  { id: 'p6', kind: 'alcohol', x: 46, z: 3 },
  { id: 'p7', kind: 'ammo',    x: 51, z: 10, n: 2 },
  { id: 'p8', kind: 'brick',   x: 39, z: 25 },
  { id: 'p9', kind: 'cloth',   x: 52, z: 2 },
  { id: 'med', kind: 'med',    x: 61, z: 24 },
  { id: 'b1', kind: 'blade',   x: 34, z: 8 },
  { id: 'b2', kind: 'binding', x: 43, z: 13 },
  { id: 'b3', kind: 'binding', x: 24, z: 8 },
  { id: 'b4', kind: 'blade',   x: 45, z: 25 },
  { id: 'a2', kind: 'alcohol', x: 15, z: 11 },
  { id: 'w1', kind: 'nailboard', x: 9, z: 9 },   // scavenged melee (see weapons.js / WEAPONS.md)
  { id: 'w2', kind: 'machete',   x: 32, z: 7 },
  { id: 'w3', kind: 'saber',     x: 50, z: 2 },   // deep in the Lurker's room: risk for reward
];

export const ENEMIES = [
  { id: 'r1', type: 'frenzied', x: 21, z: 4, yaw: Math.PI / 2 },
  { id: 'k1', type: 'knocker',  x: 23, z: 9, yaw: -Math.PI / 2 },
  { id: 'l1', type: 'lurker',   x: 45, z: 9, yaw: 0, state: 'CROSS' },
  { id: 'l2', type: 'lurker',   x: 50, z: 4, yaw: Math.PI, state: 'AMBUSH' },
  { id: 'big', type: 'bigknocker', x: 54, z: 21, yaw: -Math.PI / 2 },
  { id: 'd1', type: 'frenzied', x: 44, z: 17, state: 'DORMANT', yaw: Math.PI },
  { id: 'd2', type: 'frenzied', x: 50, z: 25, state: 'DORMANT', yaw: 0 },
  { id: 'd3', type: 'frenzied', x: 55, z: 17, state: 'DORMANT', yaw: Math.PI },
  { id: 'd4', type: 'frenzied', x: 43, z: 25, state: 'DORMANT', yaw: 0 },
];
export const ESCAPE_SPAWNS = [
  { id: 'e1', type: 'frenzied', x: 38, z: 24, yaw: -Math.PI / 2, state: 'COMBAT' },
  { id: 'e2', type: 'knocker',  x: 21, z: 21, yaw: Math.PI / 2, state: 'PATROL' },
  { id: 'e3', type: 'lurker',   x: 27, z: 24, yaw: 0, state: 'AMBUSH' },
];

// ---------------------------------------------------------------- doors
export const doors = new Map();
for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
  const c = grid[z][x];
  if (c === 'D' || c === 'L' || c === 'E') doors.set(x + ',' + z, { x, z, kind: c, open: false, locked: c !== 'D', mesh: null });
}
export const doorAt = (cx, cz) => doors.get(cx + ',' + cz);
export const obstacles = { plankPlaced: false, shutterOpen: false };
export const PLANK = { x: 23, z: 8 }, PIT = { x: 31, z: 8 }, GENERATOR = { x: 58, z: 25 }, SHUTTER = { x: 60, z: 23 };

// ---------------------------------------------------------------- queries
export const tile = (cx, cz) => (cx < 0 || cz < 0 || cx >= W || cz >= H) ? '#' : grid[cz][cx];
export const cellOf = (x, z) => [Math.floor(x / CS), Math.floor(z / CS)];
export const center = (cx, cz) => ({ x: (cx + 0.5) * CS, z: (cz + 0.5) * CS });
export const idx = (cx, cz) => cz * W + cx;
const SOLID = new Set(['#', 'H', 'W', 'M']);
export function blocksMove(cx, cz) {
  const c = tile(cx, cz);
  if (SOLID.has(c)) return true;
  if (c === 'D' || c === 'L' || c === 'E') return !doorAt(cx, cz).open;
  if (c === 'P') return !obstacles.plankPlaced;
  if (c === 'S') return !obstacles.shutterOpen;
  return false;
}
export const walkable = (cx, cz) => !blocksMove(cx, cz);
export function blocksSight(cx, cz) {
  const c = tile(cx, cz);
  if (c === '#' || c === 'M' || c === 'W') return true;
  if (c === 'D' || c === 'L' || c === 'E') return !doorAt(cx, cz).open;
  if (c === 'S') return !obstacles.shutterOpen;
  return false; // shelves are waist/chest high: see over them
}
export function areaAt(x, z) {
  const [cx, cz] = cellOf(x, z);
  for (const a of AREAS) if (cx >= a.x0 && cx <= a.x1 && cz >= a.z0 && cz <= a.z1) return a;
  return AREAS[0];
}
export function surfaceAt(x, z) { const [cx, cz] = cellOf(x, z); return tile(cx, cz); }

// line of sight: sample the segment through the grid
export function losClear(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz);
  const n = Math.ceil(d / 0.25);
  for (let i = 1; i < n; i++) {
    const t = i / n; const [cx, cz] = cellOf(x0 + dx * t, z0 + dz * t);
    if (blocksSight(cx, cz)) return false;
  }
  return true;
}
// ray march vs walls/floor/ceiling, returns distance
export function rayWall(o, dir, maxD) {
  for (let t = 0.05; t < maxD; t += 0.08) {
    const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t;
    if (y < 0 || y > WALL_H) return t;
    const [cx, cz] = cellOf(x, z); const c = tile(cx, cz);
    if (blocksSight(cx, cz)) return t;
    if ((c === 'H') && y < 1.5) return t;
    if (c === 'M' && y < 2.6) return t;
  }
  return maxD;
}

// circle vs blocked cells collision
export function collide(pos, r) {
  const [cx, cz] = cellOf(pos.x, pos.z);
  for (let iz = cz - 1; iz <= cz + 1; iz++) for (let ix = cx - 1; ix <= cx + 1; ix++) {
    if (!blocksMove(ix, iz)) continue;
    const minX = ix * CS, maxX = minX + CS, minZ = iz * CS, maxZ = minZ + CS;
    const nx = Math.max(minX, Math.min(pos.x, maxX)), nz = Math.max(minZ, Math.min(pos.z, maxZ));
    let dx = pos.x - nx, dz = pos.z - nz; const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-8) { // center inside cell: push out along shortest axis
        const l = pos.x - minX, rr = maxX - pos.x, t = pos.z - minZ, b = maxZ - pos.z;
        const m = Math.min(l, rr, t, b);
        if (m === l) pos.x = minX - r; else if (m === rr) pos.x = maxX + r; else if (m === t) pos.z = minZ - r; else pos.z = maxZ + r;
      } else { const d = Math.sqrt(d2); pos.x = nx + dx / d * r; pos.z = nz + dz / d * r; }
    }
  }
}

// ---------------------------------------------------------------- A*
export function astar(sx, sz, tx, tz, opts = {}) {
  const [scx, scz] = cellOf(sx, sz); let [tcx, tcz] = cellOf(tx, tz);
  if (blocksMove(tcx, tcz)) { const n = nearestWalkable(tcx, tcz); if (!n) return null; [tcx, tcz] = n; }
  const N = W * H, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [idx(scx, scz)]; g[open[0]] = 0; const f = new Float32Array(N).fill(Infinity);
  const h = (x, z) => { const dx = Math.abs(x - tcx), dz = Math.abs(z - tcz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  f[open[0]] = h(scx, scz);
  const goal = idx(tcx, tcz); let iter = 0;
  while (open.length && iter++ < 4000) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (cur === goal) break;
    closed[cur] = 1; const cx = cur % W, cz = (cur / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz;
      if (blocksMove(nx, nz)) continue;
      if (opts.avoidHole && tile(nx, nz) === 'O') continue;
      if (dx && dz && (blocksMove(cx + dx, cz) || blocksMove(cx, cz + dz))) continue;
      const ni = idx(nx, nz); if (closed[ni]) continue;
      let cost = (dx && dz) ? 1.414 : 1; if (tile(nx, nz) === 'O') cost += 50;
      const ng = g[cur] + cost;
      if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; f[ni] = ng + h(nx, nz); if (!open.includes(ni)) open.push(ni); }
    }
  }
  if (came[goal] < 0 && goal !== idx(scx, scz)) return null;
  const out = []; let c = goal;
  while (c >= 0 && c !== idx(scx, scz)) { out.push(center(c % W, (c / W) | 0)); c = came[c]; }
  out.reverse();
  if (out.length) out[out.length - 1] = { x: tx, z: tz, exact: !blocksMove(...cellOf(tx, tz)) };
  if (out.length && !out[out.length - 1].exact) out[out.length - 1] = center(tcx, tcz);
  return out;
}
export function nearestWalkable(cx, cz) {
  for (let r = 0; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    if (walkable(cx + dx, cz + dz) && tile(cx + dx, cz + dz) !== 'O') return [cx + dx, cz + dz];
  }
  return null;
}

// ---------------------------------------------------------------- sound propagation
// Dijkstra over walkable cells; walls block, closed doors leak with extra cost.
export function soundField(x, z, radius) {
  const dist = new Float32Array(W * H).fill(Infinity);
  const [sx, sz] = cellOf(x, z);
  const heap = [[0, sx, sz]]; dist[idx(sx, sz)] = 0;
  while (heap.length) {
    let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [d, cx, cz] = heap[bi]; heap[bi] = heap[heap.length - 1]; heap.pop();
    if (d > dist[idx(cx, cz)]) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz; const c = tile(nx, nz);
      let step = CS;
      if (c === '#' || c === 'M') continue;
      if (c === 'W') step += 6;                         // windows leak a little
      if ((c === 'D' || c === 'L' || c === 'E') && !doorAt(nx, nz).open) step += 6;
      if (c === 'S' && !obstacles.shutterOpen) step += 6;
      const nd = d + step; if (nd > radius) continue;
      const ni = idx(nx, nz); if (nd < dist[ni]) { dist[ni] = nd; heap.push([nd, nx, nz]); }
    }
  }
  return dist;
}

// ---------------------------------------------------------------- textures
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  draw(g, size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function noiseFill(g, s, base, amt, r) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  const img = g.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.beginPath(); g.arc(r() * s, r() * s, r() * s * 0.15, 0, 7); g.fill(); }
}
function makeTextures() {
  const r = rnd(7);
  const concrete = canvasTex(256, (g, s) => {
    noiseFill(g, s, '#8a8a86', 40, r);
    g.strokeStyle = 'rgba(20,20,20,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(70,60,40,${r() * 0.2})`; g.fillRect(r() * s, r() * s, r() * 50, r() * 90); }
  });
  const wall = canvasTex(256, (g, s) => {
    noiseFill(g, s, '#9a968c', 34, r);
    g.fillStyle = 'rgba(60,50,40,0.25)'; for (let i = 0; i < 30; i++) g.fillRect(r() * s, 0, 2 + r() * 3, s * (0.3 + r() * 0.7)); // water streaks
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(200,195,180,${0.2 + r() * 0.3})`; g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); for (let j = 0; j < 6; j++) g.lineTo(x + (r() - 0.5) * 50, y + (r() - 0.5) * 50); g.fill(); } // peeling paint
    g.fillStyle = 'rgba(40,70,30,0.3)'; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc(r() * s, s - r() * 50, 4 + r() * 16, 0, 7); g.fill(); } // moss at base
  });
  const tiles = canvasTex(256, (g, s) => {
    noiseFill(g, s, '#b9bfb4', 18, r); g.strokeStyle = 'rgba(40,50,40,0.5)'; g.lineWidth = 2;
    for (let i = 0; i <= s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(30,30,25,${r() * 0.35})`; g.fillRect(Math.floor(r() * 8) * 32, Math.floor(r() * 8) * 32, 32, 32); }
  });
  const wallpaper = canvasTex(256, (g, s) => {
    noiseFill(g, s, '#8d7c62', 20, r);
    g.strokeStyle = 'rgba(60,40,30,0.35)'; g.lineWidth = 3; for (let x = 0; x < s; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(120,115,105,0.9)'; g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); for (let j = 0; j < 7; j++) g.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 70); g.fill(); }
    g.fillStyle = 'rgba(30,25,15,0.4)'; for (let i = 0; i < 20; i++) g.fillRect(r() * s, r() * s * 0.2 + s * 0.8, r() * 30, 50);
  });
  const carpet = canvasTex(128, (g, s) => { noiseFill(g, s, '#5a4438', 50, r); for (let i = 0; i < 15; i++) { g.fillStyle = `rgba(20,15,10,${r() * 0.4})`; g.beginPath(); g.arc(r() * s, r() * s, r() * 30, 0, 7); g.fill(); } });
  const fungus = canvasTex(256, (g, s) => {
    noiseFill(g, s, '#6b4a2a', 50, r);
    for (let i = 0; i < 220; i++) { const x = r() * s, y = r() * s, rad = 2 + r() * 10; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${200 + r() * 40},${150 + r() * 50},${90 + r() * 40},0.9)`); gr.addColorStop(1, 'rgba(60,40,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(235,225,205,0.35)'; g.lineWidth = 1; for (let i = 0; i < 60; i++) { g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let j = 0; j < 10; j++) { x += (r() - 0.5) * 18; y += (r() - 0.5) * 18; g.lineTo(x, y); } g.stroke(); }
  });
  const metal = canvasTex(128, (g, s) => { noiseFill(g, s, '#56585a', 30, r); g.strokeStyle = 'rgba(15,15,15,0.7)'; g.lineWidth = 3; for (let i = 0; i < s; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); } g.fillStyle = 'rgba(120,60,20,0.35)'; for (let i = 0; i < 20; i++) g.fillRect(r() * s, r() * s, r() * 20, r() * 20); });
  return { concrete, wall, tiles, wallpaper, carpet, fungus, metal };
}

function textTex(lines, w, h, style) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  style(g, w, h, lines); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// generated PBR albedo + derived normal maps (assets/tex)
const TL = new THREE.TextureLoader();
function pbr(name, rx = 1, ry = rx, normalScale = 1) {
  const map = TL.load(`assets/tex/${name}.jpg`); map.colorSpace = THREE.SRGBColorSpace;
  const nrm = TL.load(`assets/tex/${name}_n.jpg`);
  for (const t of [map, nrm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; }
  return { map, normalMap: nrm, normalScale: new THREE.Vector2(normalScale, normalScale) };
}
// ---------------------------------------------------------------- world build
export function buildWorld(scene) {
  const T = makeTextures();
  const r = rnd(42);
  const world = { flicker: [], nestLights: [], escapeLights: [], tendrils: [], sign: null, doorMeshes: [], props: [], lMass: null, fallProps: [], corpses: [] };

  const areaKey = (cx, cz) => { const c = center(cx, cz); return areaAt(c.x, c.z).id; };

  // floors -------------------------------------------------------
  const M = (tex, o) => new THREE.MeshStandardMaterial({ ...tex, ...o });
  const floorMats = {
    w: M(pbr('street', 1, 1, 1.4), { color: 0x9aa2a8, roughness: 0.32, metalness: 0.1 }),
    '.': M(pbr('ceiling', 1, 1, 1), { color: 0xa8a49c, roughness: 0.88 }),
    t: M(pbr('tiles', 1, 1, 1.2), { color: 0xd0d6cc, roughness: 0.45 }),
    c: M(pbr('carpet', 1, 1, 1.5), { roughness: 1 }),
    g: M(pbr('glass', 1, 1, 1.2), { roughness: 0.35, metalness: 0.2 }),
    m: M(pbr('metal', 1, 1, 1.5), { roughness: 0.5, metalness: 0.55 }),
    f: M(pbr('fungusfloor', 1, 1, 2), { roughness: 0.55 }),
    k: M(pbr('ceiling', 1, 1, 1.5), { color: 0x6c625a, roughness: 0.95 }),
    P: M(pbr('metal', 1, 1, 1), { color: 0x303030 }),
  };
  const buckets = {};
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = grid[z][x]; if (c === '#' || c === 'O') continue;
    let key = c;
    if (key === 'P') continue;
    if (key === 'H' || key === 'M' || key === 'D' || key === 'L' || key === 'E' || key === 'n' || key === 'W' || key === 'S') key = '.';
    const a = areaKey(x, z);
    if (key === '.' && a === 'pharmacy') key = 't';
    if (key === '.' && a === 'nest' && r() < 0.35) key = 'f';
    (buckets[key] ||= []).push([x, z]);
  }
  const plane = new THREE.PlaneGeometry(CS, CS); plane.rotateX(-Math.PI / 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (const k in buckets) {
    const list = buckets[k]; const im = new THREE.InstancedMesh(plane, floorMats[k], list.length);
    list.forEach(([x, z], i) => { const c = center(x, z); m4.makeTranslation(c.x, 0, c.z); im.setMatrixAt(i, m4); });
    im.receiveShadow = true; scene.add(im);
  }
  // puddles on wet ground
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x3a444c, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.38, depthWrite: false });
  for (const [x, z] of buckets.w || []) if (r() < 0.18) {
    const c = center(x, z); const p = new THREE.Mesh(new THREE.CircleGeometry(0.25 + r() * 0.45, 20), puddleMat);
    p.rotation.x = -Math.PI / 2; p.scale.x = 1 + r(); p.position.set(c.x + (r() - 0.5), 0.01, c.z + (r() - 0.5)); p.receiveShadow = true; scene.add(p);
  }
  // broken glass shards
  const shardGeo = new THREE.PlaneGeometry(0.08, 0.05); shardGeo.rotateX(-Math.PI / 2);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xcfe8e0, roughness: 0.05, metalness: 0.8, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const glassCells = buckets.g || []; const shards = new THREE.InstancedMesh(shardGeo, shardMat, glassCells.length * 60);
  let si = 0;
  for (const [x, z] of glassCells) { const c = center(x, z); for (let i = 0; i < 60; i++) { q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * 6, 0)); v.set(c.x + (r() - 0.5) * CS, 0.015, c.z + (r() - 0.5) * CS); sc.setScalar(0.5 + r() * 1.5); m4.compose(v, q, sc); shards.setMatrixAt(si++, m4); } }
  sc.set(1, 1, 1); scene.add(shards);

  // walls ---------------------------------------------------------
  const wallGeo = new THREE.BoxGeometry(CS, WALL_H, CS);
  const wallTint = { street: 0x6d7479, pharmacy: 0x9aa89a, corridor: 0x6e6a62, apartment: 0xb09a80, nest: 0x6a4c34, escape: 0x6e6a62, outside: 0x6d7479 };
  const wallCells = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (grid[z][x] !== '#') continue;
    let adj = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const t = tile(x + dx, z + dz); if (t !== '#') { adj = [x + dx, z + dz]; break; } }
    if (adj) wallCells.push([x, z, areaKey(adj[0], adj[1])]);
  }
  const wallMat = M(pbr('wall', 1, 2, 1.3), { roughness: 0.9 });
  const areaWall = {
    street: M(pbr('brick', 1, 2, 1.6), { roughness: 0.85 }), outside: null, pharmacy: M(pbr('wall', 1, 2, 1.3), { color: 0xc8d8c8, roughness: 0.9 }),
    corridor: wallMat, apartment: M(pbr('wallpaper', 1, 2, 1.2), { roughness: 0.95 }), nest: M(pbr('funguswall', 1, 2, 2.2), { roughness: 0.6 }), escape: M(pbr('funguswall', 1, 2, 1.8), { color: 0x9a8a80, roughness: 0.7 }),
  };
  areaWall.outside = areaWall.street;
  const wallTintK = { street: 0xffffff, outside: 0xffffff, pharmacy: 0xffffff, corridor: 0x9a968e, apartment: 0xffffff, nest: 0xffffff, escape: 0xffffff };
  for (const a of Object.keys(areaWall)) {
    const list = wallCells.filter(w => w[2] === a), mat = areaWall[a]; if (!list.length) continue;
    const im = new THREE.InstancedMesh(wallGeo, mat, list.length); const col = new THREE.Color();
    list.forEach(([x, z, a], i) => { const c = center(x, z); m4.makeTranslation(c.x, WALL_H / 2, c.z); im.setMatrixAt(i, m4); col.setHex(wallTintK[a]).multiplyScalar(0.8 + r() * 0.3); im.setColorAt(i, col); });
    im.castShadow = im.receiveShadow = true; scene.add(im);
  }
  // ceilings for interiors
  const ceilCells = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (grid[z][x] === '#') continue; const a = areaKey(x, z);
    if (a === 'street' || a === 'outside') continue;
    if (a === 'apartment' && x >= 45 && x <= 47 && z >= 11 && z <= 13) continue; // collapsed ceiling
    ceilCells.push([x, z]);
  }
  const ceilGeo = new THREE.PlaneGeometry(CS, CS); ceilGeo.rotateX(Math.PI / 2);
  const ceil = new THREE.InstancedMesh(ceilGeo, M(pbr('ceiling', 1, 1, 1.4), { color: 0x6a6660, roughness: 1 }), ceilCells.length);
  ceilCells.forEach(([x, z], i) => { const c = center(x, z); m4.makeTranslation(c.x, WALL_H, c.z); ceil.setMatrixAt(i, m4); });
  ceil.receiveShadow = true; scene.add(ceil);

  // helpers
  const std = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const box = (w, h, d, mat, x, y, z, ry = 0, parent = scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const cyl = (rt, rb, h, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  const rust = std(0x6b4a33, 0.8, 0.4, { map: T.metal }), shelfMat = std(0x7b8078, 0.6, 0.5, { map: T.metal }), wood = std(0x4d3a2a, 0.9), fabric = std(0x5d5a48, 1), dark = std(0x1c1c1c, 0.9);

  // shelves / furniture / machinery
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = grid[z][x]; const c = center(x, z); const a = areaKey(x, z);
    if (ch === 'H' && x === GENERATOR.x && z === GENERATOR.z) {
      const g = prop('generator', { size: [1.3, 1.1, 1.0], yaw: Math.PI / 2 }) || new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 0.8), std(0xb09020, 0.6, 0.3));
      g.position.set(c.x, g.isMesh ? 0.45 : 0, c.z); scene.add(g); world.generator = g; continue;
    }
    if (ch === 'H') {
      const glb = a === 'pharmacy' ? (r() < 0.8 ? prop('shelf', { size: [1.9, 1.9, 0.9], yaw: (x + z) % 2 ? 0 : Math.PI }) : prop('counter', { size: [1.9, 1.3, 1.2] }))
        : a === 'apartment' ? [prop('sofa', { size: [1.9, 1.0, 1.0], yaw: r() * 0.4 }), prop('table', { size: [1.6, 1.2, 1.6], yaw: r() * 2 }), prop('wardrobe', { size: [1.3, 2.1, 0.8], yaw: 0 })][(x * 7 + z) % 3]
        : [prop('crate', { size: [1.2, 1.0, 1.2], yaw: r() * 3 }), prop('barrel', { height: 1.0 }), prop('dumpster', { size: [1.9, 1.5, 1.4], yaw: r() })][(x + z) % 3];
      if (glb) {
        glb.position.set(c.x, 0, c.z); if (a === 'pharmacy' && r() < 0.25) { glb.rotation.z = 0.12; }
        scene.add(glb);
        if (a !== 'pharmacy' && a !== 'apartment' && r() < 0.6) { const b2 = prop('barrel', { height: 0.9 }); if (b2) { b2.position.set(c.x + 0.6, 0, c.z - 0.5); scene.add(b2); } }
        continue;
      }
      if (a === 'pharmacy') {
        const g = new THREE.Group(); g.position.set(c.x, 0, c.z); scene.add(g);
        const tilt = r() < 0.3 ? 0.25 : 0; g.rotation.z = tilt;
        box(1.9, 0.05, 0.9, shelfMat, 0, 0.1, 0, 0, g); box(1.9, 0.05, 0.9, shelfMat, 0, 0.7, 0, 0, g); box(1.9, 0.05, 0.9, shelfMat, 0, 1.3, 0, 0, g);
        box(0.05, 1.5, 0.9, shelfMat, -0.93, 0.75, 0, 0, g); box(0.05, 1.5, 0.9, shelfMat, 0.93, 0.75, 0, 0, g);
        for (let i = 0; i < 10; i++) if (r() < 0.6) { const b = cyl(0.04, 0.04, 0.12, std([0xd8d0c0, 0xe07a30, 0xf2f2ee, 0x3c6fb0][i % 4], 0.5), -0.8 + r() * 1.6, [0.19, 0.79, 1.39][i % 3], (r() - 0.5) * 0.6, g); }
      } else if (a === 'apartment') {
        const kind = (x * 7 + z) % 3;
        if (kind === 0) { box(1.8, 0.45, 0.9, fabric, c.x, 0.3, c.z); box(1.8, 0.5, 0.2, fabric, c.x, 0.7, c.z - 0.4); } // couch
        else if (kind === 1) { box(1.4, 0.06, 0.9, wood, c.x, 0.78, c.z); for (const [dx, dz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) box(0.06, 0.78, 0.06, wood, c.x + dx, 0.39, c.z + dz); // table + rotting meal
          cyl(0.13, 0.1, 0.03, std(0xd8d2c0, 0.4), c.x - 0.2, 0.83, c.z); box(0.12, 0.05, 0.08, std(0x3a3a18, 1), c.x - 0.2, 0.86, c.z); }
        else { box(1.2, 1.9, 0.6, wood, c.x, 0.95, c.z); } // wardrobe
      } else { box(1.6, 0.9, 1.6, std(0x3a3632, 0.9), c.x, 0.45, c.z, r()); } // rubble / debris
    }
    if (ch === 'M') {
      const bo = prop('boiler', { size: [1.9, 2.6, 1.7], yaw: ((x + z) % 4) * Math.PI / 2 });
      if (bo) { bo.position.set(c.x, 0, c.z); scene.add(bo); if (r() < 0.35) { const fm = prop('fungusmass', { height: 0.6 + r() * 0.8, yaw: r() * 6 }); if (fm) { fm.position.set(c.x + (r() - 0.5), 0, c.z + (r() - 0.5) * 1.2); scene.add(fm); } } continue; }
      const hgt = 1.8 + r() * 0.9; box(1.9, hgt, 1.6, rust, c.x, hgt / 2, c.z);
      if (r() < 0.5) cyl(0.25, 0.25, WALL_H, rust, c.x + 0.6, WALL_H / 2, c.z + 0.6);
      box(2.0, 0.15, 0.15, rust, c.x, hgt + 0.3, c.z);
    }
    if (ch === 'W') { // window: frame + cracked glass
      const frame = std(0x2d2f30, 0.5, 0.6);
      box(0.12, WALL_H, 0.12, frame, c.x, WALL_H / 2, c.z - 0.95); box(0.12, WALL_H, 0.12, frame, c.x, WALL_H / 2, c.z + 0.95);
      box(0.3, 0.8, CS, std(0x5a5a58, 0.9), c.x, 0.4, c.z); box(0.3, 0.5, CS, std(0x5a5a58, 0.9), c.x, WALL_H - 0.25, c.z);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(CS, WALL_H - 1.3), new THREE.MeshStandardMaterial({ color: 0x9fb8c0, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.9, side: THREE.DoubleSide }));
      glass.rotation.y = Math.PI / 2; glass.position.set(c.x, 0.8 + (WALL_H - 1.3) / 2, c.z); scene.add(glass);
    }
    if (ch === 'n') { // jammed door you squeeze past
      box(0.12, 2.4, 1.3, std(0x4a4f4c, 0.6, 0.5), c.x - 0.6, 1.2, c.z - 0.2, 0.9);
      box(0.3, WALL_H - 2.4, CS, wallMat, c.x, 2.4 + (WALL_H - 2.4) / 2, c.z);
    }
    if (ch === 'O') { // hole down to the nest: glowing amber pit
      const pit = new THREE.Mesh(new THREE.PlaneGeometry(CS * 0.9, CS * 0.9), new THREE.MeshBasicMaterial({ color: 0x2a1406 })); pit.rotation.x = -Math.PI / 2; pit.position.set(c.x, -0.6, c.z); scene.add(pit);
      const glow = new THREE.PointLight(0xff9a40, 4, 6, 1.6); glow.position.set(c.x, -0.3, c.z); scene.add(glow);
      for (let i = 0; i < 8; i++) { const a2 = i / 8 * Math.PI * 2; box(0.5, 0.25, 0.3, std(0x4a4540), c.x + Math.cos(a2) * 1.05, 0.05, c.z + Math.sin(a2) * 1.05, a2); }
    }
  }
  // doors
  for (const d of doors.values()) {
    const c = center(d.x, d.z); const g = new THREE.Group(); g.position.set(c.x, 0, c.z); scene.add(g);
    if (d.kind === 'D') {
      const hinge = new THREE.Group(); hinge.position.set(0, 0, -0.9); g.add(hinge);
      const panelMat = std(d.x === 11 ? 0x5b6266 : 0x4a4038, 0.5, d.x === 11 ? 0.7 : 0.1, { map: T.metal });
      box(0.08, 2.3, 1.8, panelMat, 0, 1.15, 0.9, 0, hinge);
      box(0.1, 0.03, 0.2, std(0xaaaaaa, 0.3, 1), 0.08, 1.05, 1.5, 0, hinge);
      box(0.25, WALL_H - 2.3, CS, wallMat, 0, 2.3 + (WALL_H - 2.3) / 2, 0, 0, g);
      d.mesh = hinge;
    } else if (d.kind === 'E') {
      const hinge = new THREE.Group(); hinge.position.set(0, 0, -0.9); g.add(hinge);
      box(0.1, 2.3, 1.8, std(0x6a1c18, 0.5, 0.5), 0, 1.15, 0.9, 0, hinge);
      box(0.12, 0.08, 1.4, std(0x999999, 0.3, 1), 0.1, 1.05, 0.9, 0, hinge);
      box(0.25, WALL_H - 2.3, CS, wallMat, 0, 2.3 + (WALL_H - 2.3) / 2, 0, 0, g);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.25), new THREE.MeshBasicMaterial({ map: textTex(['EXIT'], 256, 96, (gg, w, h) => { gg.fillStyle = '#300'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#ff4030'; gg.font = 'bold 70px sans-serif'; gg.textAlign = 'center'; gg.fillText('EXIT', w / 2, 72); }) }));
      sign.position.set(0.2, 2.6, 0); sign.rotation.y = Math.PI / 2; g.add(sign);
      d.mesh = hinge;
    } else { // L: door sealed by fungal mass
      const mass = new THREE.Group(); g.add(mass);
      box(0.2, 2.3, 1.8, std(0x3a3028, 0.8), 0, 1.15, 0, 0, mass);
      for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(bulbGeo(), std(i % 3 ? 0x9a6a3a : 0xd8b890, 0.7)); b.scale.setScalar(0.2 + r() * 0.45); b.position.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 2); mass.add(b); }
      world.lMass = mass; d.mesh = mass;
    }
    world.doorMeshes.push(d);
  }

  // ---------------------------------------------------------------- street dressing
  const awning = new THREE.Group(); scene.add(awning);
  box(4.5, 0.08, 3, std(0x2e3a34, 0.9), 7, 3.1, 15, 0, awning).rotation.z = 0.25; // collapsed awning
  box(0.1, 3.2, 0.1, rust, 5.2, 1.6, 13.6, 0, awning); box(0.1, 2.4, 0.1, rust, 9, 1.2, 13.8, 0, awning).rotation.z = 0.35;
  // wrecked car
  { const rv = prop('raven', { height: 0.55, yaw: -1.2 }); if (rv) { rv.position.set(12.2, 1.32, 8.1); scene.add(rv); world.raven = rv; } } // perched on the wrecked car's roof (FAB ASSETS)
  const carGlb = prop('car', { size: [4.3, 1.6, 2.0], yaw: 0.35 });
  if (carGlb) { carGlb.position.set(12, 0, 8); scene.add(carGlb); }
  for (const [pid, px, pz, opt] of [['dumpster', 3.2, 21.2, { size: [1.9, 1.5, 1.3], yaw: Math.PI / 2 }], ['barrel', 17, 5, { height: 0.9 }], ['barrel', 18, 4.2, { height: 0.9 }], ['crate', 4, 24, { size: [1, 0.8, 1], yaw: 0.4 }], ['dumpster', 12, 44, { size: [1.9, 1.5, 1.3], yaw: 0.2 }], ['barrel', 18, 47, { height: 0.9 }]]) { const o = prop(pid, opt); if (o) { o.position.set(px, 0, pz); scene.add(o); } }
  const car = new THREE.Group(); car.position.set(12, 0, 17); car.rotation.y = 0.4; if (!carGlb) scene.add(car);
  box(1.9, 0.8, 4.2, std(0x3e4d56, 0.4, 0.6), 0, 0.7, 0, 0, car); box(1.7, 0.6, 2.2, std(0x2a3238, 0.3, 0.5), 0, 1.35, -0.2, 0, car);
  for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) { const w2 = cyl(0.35, 0.35, 0.25, dark, x, 0.35, z, car); w2.rotation.z = Math.PI / 2; }
  car.position.set(6, 0, 20); // in street
  // pharmacy sign across street, flickering green
  const signTex = textTex(['PHARMACY'], 512, 128, (gg, w, h) => { gg.fillStyle = '#081208'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#7dff9a'; gg.font = 'bold 84px Arial Narrow, sans-serif'; gg.textAlign = 'center'; gg.fillText('+ PHARMACY', w / 2, 94); });
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, color: 0xffffff });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), signMat); sign.position.set(21.9, 3.1, 15); sign.rotation.y = -Math.PI / 2; scene.add(sign);
  const signLight = new THREE.PointLight(0x70ff90, 6, 10, 1.5); signLight.position.set(20.8, 3, 15); scene.add(signLight);
  world.sign = { mat: signMat, light: signLight };
  // hanging vegetation & ivy on street walls
  const leafMat = std(0x3f5a2a, 0.9, 0, { side: THREE.DoubleSide });
  const leafGeo = new THREE.PlaneGeometry(0.13, 0.17);
  const vines = new THREE.InstancedMesh(leafGeo, leafMat, 5200); let vi = 0;
  const vineSpots = [];
  for (const [x, z, a] of wallCells) if (a === 'street' || a === 'outside' || (a === 'pharmacy' && r() < 0.4) || (a === 'apartment' && r() < 0.2)) vineSpots.push([x, z]);
  for (const [x, z] of vineSpots) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (tile(x + dx, z + dz) === '#') continue;
      const c = center(x, z); const nx = c.x + dx * (CS / 2 + 0.03), nz = c.z + dz * (CS / 2 + 0.03);
      const count = 60 + Math.floor(r() * 80);
      for (let i = 0; i < count && vi < 5200; i++) {
        const t = (r() - 0.5) * CS; const y = WALL_H - Math.pow(r(), 0.6) * WALL_H;
        v.set(nx + (dz ? t : 0) + dx * r() * 0.1, y, nz + (dx ? t : 0) + dz * r() * 0.1);
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 1.2, Math.atan2(dx, dz) + (r() - 0.5), (r() - 0.5) * 1.2)); sc.setScalar(0.6 + r());
        m4.compose(v, q, sc); vines.setMatrixAt(vi++, m4);
      }
    }
  }
  vines.count = vi; sc.set(1, 1, 1); vines.castShadow = true; scene.add(vines);
  // hanging vines inside pharmacy entrance (shield-face zone)
  world.hangingVines = [];
  for (let i = 0; i < 14; i++) { const len = 1 + r() * 1.8; const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, len, 4), leafMat); s2.position.set(24.5 + r() * 2, WALL_H - len / 2, 11 + r() * 8); scene.add(s2); world.hangingVines.push(s2); }

  // ---------------------------------------------------------------- lights
  // pharmacy fluorescent remnants
  for (const [x, z] of [[16, 6], [22, 11]]) {
    const c = center(x, z); const tube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.15), new THREE.MeshBasicMaterial({ color: 0xc8ffd0 }));
    tube.position.set(c.x, WALL_H - 0.3, c.z); tube.rotation.z = x === 16 ? 0 : 0.35; scene.add(tube);
    const L = new THREE.PointLight(0xa8ffc0, 7, 13, 1.4); L.position.set(c.x, WALL_H - 0.5, c.z); scene.add(L);
    world.flicker.push({ light: L, mesh: tube, base: 7, rate: 0.5 + r() });
  }
  // corridor: one dying emergency bulb and a caged work light
  for (const [x, z, col, inten] of [[28, 10, 0xffb070, 2.2], [35, 7, 0x9ab0c0, 1.6]]) { const c = center(x, z); const L2 = new THREE.PointLight(col, inten, 7, 1.6); L2.position.set(c.x, WALL_H - 0.4, c.z); scene.add(L2); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: col })); bulb.position.copy(L2.position); scene.add(bulb); world.flicker.push({ light: L2, mesh: bulb, base: inten, rate: 1.7 }); }
  // apartment grey window light
  const aptL = new THREE.PointLight(0x8aa0b8, 5, 12, 1.4); aptL.position.set(center(51, 11).x, 3, center(51, 11).z); scene.add(aptL);
  const collapseL = new THREE.SpotLight(0x9ab0c8, 40, 14, 0.6, 0.6, 1.2); collapseL.position.set(center(46, 12).x, 9, center(46, 12).z); collapseL.target.position.set(center(46, 12).x, 0, center(46, 12).z); scene.add(collapseL, collapseL.target);
  // nest amber
  for (const [x, z] of [[44, 21], [52, 18], [57, 24], [61, 23]]) { const c = center(x, z); const L = new THREE.PointLight(0xff9a48, 5, 12, 1.5); L.position.set(c.x, 1.2, c.z); scene.add(L); world.nestLights.push(L); }
  // escape red emergency (off until escape)
  for (const [x, z] of [[33, 22], [27, 24], [20, 22], [16, 24], [35, 24]]) { const c = center(x, z); const L = new THREE.PointLight(0xff2010, 0, 11, 1.4); L.position.set(c.x, WALL_H - 0.4, c.z); scene.add(L); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x401010 })); lamp.position.copy(L.position); scene.add(lamp); world.escapeLights.push({ light: L, lamp }); }

  // ---------------------------------------------------------------- environmental storytelling
  const story = (x, z) => center(x, z);
  let p;
  p = story(40, 3); box(0.3, 0.38, 0.18, std(0xd06080, 0.9), p.x + 0.4, 0.19, p.z + 0.6, 0.4); // child's backpack
  cyl(0.06, 0.06, 0.02, std(0xf0f0f0, 0.5), p.x + 0.7, 0.01, p.z + 0.8);
  p = story(22, 12); const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), std(0x88c0e8, 0.6)); band.position.set(p.x - 0.4, 0.01, p.z - 0.3); band.rotation.x = Math.PI / 2; scene.add(band); // hospital wristband
  // quarantine notice
  const notice = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ map: textTex([], 256, 340, (gg, w, h) => { gg.fillStyle = '#d8d2b8'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#8a1a14'; gg.fillRect(0, 0, w, 60); gg.fillStyle = '#fff'; gg.font = 'bold 34px sans-serif'; gg.fillText('QUARANTINE', 18, 44); gg.fillStyle = '#222'; gg.font = '18px serif'; ['ZONE 4 — NORTH SECTOR', 'Residents must report', 'to the checkpoint for', 'screening. Do not', 'approach anyone showing', 'symptoms.'].forEach((l, i) => gg.fillText(l, 16, 100 + i * 30)); gg.fillStyle = 'rgba(80,60,30,0.4)'; gg.fillRect(0, 230, w, 110); }), roughness: 1 }));
  notice.position.set(11 * CS + CS + 0.02, 1.6, center(12, 11).z + 0.4); notice.rotation.y = Math.PI / 2; scene.add(notice);
  // half-open suitcase in corridor
  p = story(32, 7); box(0.7, 0.18, 0.45, std(0x3a4a6a, 0.8), p.x, 0.09, p.z + 0.3, 0.3); const lid = box(0.7, 0.05, 0.45, std(0x3a4a6a, 0.8), p.x, 0.35, p.z + 0.05, 0.3); lid.rotation.x = -1.1;
  for (let i = 0; i < 5; i++) box(0.3, 0.02, 0.2, std([0x886655, 0xaaaaaa, 0x557788][i % 3], 1), p.x + (r() - 0.5) * 1.2, 0.02, p.z + 0.6 + r() * 0.5, r() * 3);
  // barricade broken inward (planks fallen inward toward pharmacy)
  p = story(12, 11); for (let i = 0; i < 4; i++) { const pl = box(0.12, 0.04, 1.6, wood, p.x + 0.5 + i * 0.25, 0.05 + i * 0.02, p.z - 0.2 + (r() - 0.5) * 0.4, 0.8 + (r() - 0.5) * 0.5); pl.rotation.z = (r() - 0.5) * 0.2; }
  // blood trail leading into fungus (corridor -> nook)
  const bloodMat = new THREE.MeshStandardMaterial({ color: 0x2a0806, roughness: 0.3, transparent: true, opacity: 0.85, depthWrite: false });
  for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.1 + r() * 0.15, 10), bloodMat); b.rotation.x = -Math.PI / 2; const t = i / 16; b.position.set(center(29, 10).x + t * 10, 0.012, center(29, 10).z - t * (i > 8 ? 4 : 0.5) + (r() - 0.5) * 0.3); b.scale.x = 1.5; scene.add(b); }
  // shell casings and old boxes
  for (let i = 0; i < 6; i++) box(0.5, 0.4, 0.5, std(0x7a6448, 1), center(23, 7).x + (r() - 0.5) * 3, 0.2 + (i > 3 ? 0.4 : 0), center(23, 7).z + r() * 1.5, r());

  // ---------------------------------------------------------------- environmental puzzles
  { // collapsed corridor floor: a glimpse of the amber-lit nest far below
    const c = center(PIT.x, PIT.z);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(CS, CS), new THREE.MeshBasicMaterial({ color: 0x050302 })); hole.rotation.x = -Math.PI / 2; hole.position.set(c.x, -4.5, c.z); scene.add(hole);
    const shaft = std(0x16120e, 1, 0, { map: T.concrete }); // dark broken shaft dropping toward the nest
    for (const dz of [-0.98, 0.98]) box(2, 4.5, 0.06, shaft, c.x, -2.25, c.z + dz);
    for (const dx of [-0.98, 0.98]) box(0.06, 4.5, 2, shaft, c.x + dx, -2.25, c.z);
    for (let i = 0; i < 5; i++) { const sl = box(0.5 + r() * 0.5, 0.14, 0.4 + r() * 0.3, std(0x4a4640, 0.95, 0, { map: T.concrete }), c.x + (r() - 0.5) * 1.2, -0.1 - r() * 0.25, c.z + (i % 2 ? 0.75 : -0.75), r() * 3); sl.rotation.x = (i % 2 ? -1 : 1) * (0.4 + r() * 0.4); } // floor slabs snapped into the hole
    for (let i = 0; i < 6; i++) { const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7 + r() * 0.5, 4), std(0x5a3a22, 0.7, 0.6)); rb.position.set(c.x + (r() - 0.5) * 1.6, -0.25, c.z + (r() < 0.5 ? -0.9 : 0.9)); rb.rotation.set(0.6 + r(), r() * 3, r()); scene.add(rb); } // exposed rebar
    const glow = new THREE.PointLight(0xff8a30, 7, 4.5, 1.6); glow.position.set(c.x, -3.6, c.z); scene.add(glow); // the nest, glimpsed far below
    for (let i = 0; i < 7; i++) box(0.2 + r() * 0.25, 0.1, 0.25, std(0x4a4640, 0.95, 0, { map: T.concrete }), c.x + (r() - 0.5) * 1.8, 0.04, c.z + (r() < 0.5 ? -1.15 : 1.15), r() * 3);
    let pl = prop('plank', { size: [2.7, 0.1, 0.35] });
    if (!pl) { pl = new THREE.Group(); box(2.7, 0.06, 0.32, std(0x6a5038, 0.9), 0, 0.03, 0, 0, pl); }
    const p0 = center(PLANK.x, PLANK.z); pl.position.set(p0.x + 0.6, 0.05, p0.z - 0.7); pl.rotation.set(0, 0.2, 0); scene.add(pl);
    world.plank = pl; world.pitCenter = c;
  }
  { // storeroom rolling shutter, raised by the generator
    const c = center(SHUTTER.x, SHUTTER.z); const g = new THREE.Group(); g.position.set(c.x, 0, c.z); scene.add(g);
    const slatMat = std(0x6a6e70, 0.55, 0.7, { map: T.metal });
    for (let i = 0; i < 14; i++) box(0.08, 0.18, CS * 0.98, slatMat, 0, 0.1 + i * 0.19, 0, 0, g);
    box(0.3, WALL_H - 2.7, CS, wallMat, c.x, 2.7 + (WALL_H - 2.7) / 2, c.z);
    world.shutter = g;
    const lamp = new THREE.PointLight(0xffb060, 0, 7, 1.5); lamp.position.set(c.x + 1.5, 3.2, c.z); scene.add(lamp); world.storeLamp = lamp;
  }
  // nest dressing: fungal masses, cocoons hanging from the ceiling
  for (let i = 0; i < 30; i++) {
    const x = 38 + ((r() * 25) | 0), z = 17 + ((r() * 9) | 0); if (tile(x, z) === '#') continue; const c = center(x, z);
    if (i % 3 === 0) { const co = prop('cocoon', { height: 0.9 + r() * 0.9, yaw: r() * 6 }); if (co) { co.position.set(c.x + (r() - 0.5), WALL_H - 1.6 - r() * 0.3, c.z + (r() - 0.5)); scene.add(co); } }
    else if (walkable(x, z) && i % 3 === 1) { const fm = prop('fungusmass', { height: 0.4 + r() * 0.8, yaw: r() * 6 }); if (fm) { fm.position.set(c.x + (r() - 0.5) * 1.6, 0, c.z + (r() - 0.5) * 1.6); scene.add(fm); } }
  }
  for (const [x, z, hgt] of [[38, 17, 3.6], [62, 17, 3.2], [38, 25, 3.8], [59, 18, 3.4], [48, 24, 2.6], [36, 22, 3], [20, 25, 2.6]]) {
    const c = center(x, z); const fp = prop('funguspillar', { height: hgt, yaw: r() * 6 }); if (fp) { fp.position.set(c.x + (r() - 0.5) * 0.6, 0, c.z + (r() - 0.5) * 0.6); fp.scale.x *= 1.5; fp.scale.z *= 1.5; scene.add(fp); }
  }
  for (const [x, z] of [[30, 10], [36, 8], [27, 10], [16, 22], [28, 25], [33, 21], [35, 9]]) { const c = center(x, z); const fm = prop('fungusmass', { height: 0.5 + r() * 0.6, yaw: r() * 6 }); if (fm) { fm.position.set(c.x + (r() - 0.5), 0, c.z + (r() < 0.5 ? -0.7 : 0.7)); scene.add(fm); } }

  // ---------------------------------------------------------------- fungus
  buildFungus(scene, world, wallCells, r, T);
  return world;
}

// displaced icosahedron for bulbous growth
let _bulb = null;
function bulbGeo() {
  if (_bulb) return _bulb;
  const g = new THREE.IcosahedronGeometry(1, 2); const pos = g.attributes.position; const vv = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { vv.fromBufferAttribute(pos, i); const n = 1 + 0.18 * Math.sin(vv.x * 5 + vv.y * 3) * Math.cos(vv.z * 4) + 0.08 * Math.sin(vv.y * 11); vv.multiplyScalar(n); pos.setXYZ(i, vv.x, vv.y, vv.z); }
  g.computeVertexNormals(); _bulb = g; return g;
}

function buildFungus(scene, world, wallCells, r, T) {
  const density = { street: 0.02, outside: 0.05, pharmacy: 0.12, corridor: 0.55, apartment: 0.35, nest: 1.0, escape: 0.6 };
  const shelfGeo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const shelfMat = new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0xffffff, map: T.fungus });
  const bulbMat = new THREE.MeshStandardMaterial({ roughness: 0.55, color: 0xffffff, map: T.fungus });
  const stalkGeo = new THREE.CylinderGeometry(0.01, 0.018, 1, 5); stalkGeo.translate(0, 0.5, 0);
  const capGeo = new THREE.SphereGeometry(1, 8, 6);
  const MAX = 6000;
  const shelves = new THREE.InstancedMesh(shelfGeo, shelfMat, MAX), bulbs = new THREE.InstancedMesh(bulbGeo(), bulbMat, 1500);
  const stalks = new THREE.InstancedMesh(stalkGeo, new THREE.MeshStandardMaterial({ color: 0xcfbfa0, roughness: 0.8 }), 1500);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xe0b070, roughness: 0.5, emissive: 0x2a1000 }), 1500);
  let ns = 0, nb = 0, nst = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const shelfColors = [0xd9a86a, 0xc48a4c, 0xe8d0a8, 0x9a6a3a, 0xb07a44, 0xf0e2c4];
  const myceliumPts = [];
  const addMycelium = (ox, oy, oz, nx, nz, n, spread) => { // random branching lines on a wall face
    const tx = nz, tz = -nx; const stack = [[0, 0, r() * Math.PI * 2, n]];
    while (stack.length) {
      let [u, y, ang, left] = stack.pop();
      while (left-- > 0) {
        const len = 0.05 + r() * 0.12; const u2 = u + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        if (Math.abs(u2) > spread || oy + y2 < 0.02 || oy + y2 > WALL_H) break;
        myceliumPts.push(ox + tx * u, oy + y, oz + tz * u, ox + tx * u2, oy + y2, oz + tz * u2);
        u = u2; y = y2; ang += (r() - 0.5) * 0.9;
        if (r() < 0.12) stack.push([u, y, ang + (r() - 0.5) * 2, left * 0.6 | 0]);
      }
    }
  };
  for (const [x, z, a] of wallCells) {
    const d = density[a] || 0; if (d <= 0) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (tile(x + dx, z + dz) === '#' || r() > d) continue;
      const c = center(x, z); const fx = c.x + dx * CS / 2, fz = c.z + dz * CS / 2;
      // colonies follow cracks: cluster around a seed line
      const seedT = (r() - 0.5) * CS * 0.8, seedY = a === 'nest' ? r() * WALL_H : Math.pow(r(), 1.5) * WALL_H;
      const count = Math.floor((a === 'nest' ? 26 : 10) * d + r() * 8);
      for (let i = 0; i < count && ns < MAX; i++) {
        const t = seedT + (r() - 0.5) * 0.9, y = Math.max(0.05, Math.min(WALL_H - 0.05, seedY + (r() - 0.5) * 1.6));
        v.set(fx + (dz ? t : 0), y, fz + (dx ? t : 0));
        const n = new THREE.Vector3(dx, (r() - 0.5) * 0.3, dz).normalize(); q.setFromUnitVectors(up, n);
        const sz = 0.05 + Math.pow(r(), 2) * (a === 'nest' ? 0.4 : 0.22);
        s.set(sz, sz * (0.9 + r() * 0.6), sz * 0.35);
        m4.compose(v, q, s); shelves.setMatrixAt(ns, m4); col.setHex(shelfColors[(r() * shelfColors.length) | 0]).multiplyScalar(0.7 + r() * 0.4); shelves.setColorAt(ns, col); ns++;
      }
      if (r() < d * 0.8 && nb < 1500) { v.set(fx + (dz ? seedT : 0), seedY * 0.5, fz + (dx ? seedT : 0)); const bs = 0.2 + r() * (a === 'nest' ? 0.9 : 0.35); s.set(bs, bs * (0.7 + r() * 0.6), bs); q.setFromEuler(new THREE.Euler(r(), r() * 6, r())); m4.compose(v, q, s); bulbs.setMatrixAt(nb, m4); col.setHex(r() < 0.5 ? 0xa87848 : 0xe0c49a).multiplyScalar(0.8 + r() * 0.3); bulbs.setColorAt(nb++, col); }
      if (a !== 'street') addMycelium(fx + dx * 0.02, seedY, fz + dz * 0.02, dx, dz, a === 'nest' ? 70 : 30, 0.95);
      // fruiting bodies on stalks
      if ((a === 'nest' || a === 'escape' || a === 'corridor') && r() < d * 0.7) for (let i = 0; i < 4 && nst < 1500; i++) {
        const t = seedT + (r() - 0.5) * 0.6, y = Math.max(0.1, seedY + (r() - 0.5));
        v.set(fx + (dz ? t : 0) + dx * 0.05, y, fz + (dx ? t : 0) + dz * 0.05); const n = new THREE.Vector3(dx + (r() - 0.5) * 0.6, 0.7 + r() * 0.3, dz + (r() - 0.5) * 0.6).normalize(); q.setFromUnitVectors(up, n);
        const len = 0.15 + r() * 0.35; s.set(1, len, 1); m4.compose(v, q, s); stalks.setMatrixAt(nst, m4);
        const tip = v.clone().addScaledVector(n, len); s.setScalar(0.025 + r() * 0.03); m4.compose(tip, q, s); caps.setMatrixAt(nst, m4); nst++;
      }
    }
  }
  // nest floor & ceiling: bulbs, mats, hanging masses
  for (let z = 16; z < H; z++) for (let x = 37; x < W; x++) {
    const ch = tile(x, z); if (ch === '#' || ch === 'M') continue; const c = center(x, z);
    const n = ch === 'f' ? 5 : 2;
    for (let i = 0; i < n && nb < 1500; i++) {
      if (ch !== 'f' && r() < 0.5) continue;
      v.set(c.x + (r() - 0.5) * CS, 0, c.z + (r() - 0.5) * CS); const bs = 0.08 + r() * (ch === 'f' ? 0.3 : 0.18); s.set(bs, bs * 0.5, bs); q.identity(); m4.compose(v, q, s); bulbs.setMatrixAt(nb, m4); col.setHex(0xc89a60).multiplyScalar(0.6 + r() * 0.5); bulbs.setColorAt(nb++, col);
    }
    if (r() < 0.35 && nb < 1500) { v.set(c.x + (r() - 0.5) * CS, WALL_H - 0.1, c.z + (r() - 0.5) * CS); const bs = 0.3 + r() * 0.6; s.set(bs, bs * 1.6, bs); q.identity(); m4.compose(v, q, s); bulbs.setMatrixAt(nb, m4); col.setHex(0x8a5a30); bulbs.setColorAt(nb++, col); }
    for (let i = 0; i < (ch === 'f' ? 6 : 2) && nst < 1500; i++) { v.set(c.x + (r() - 0.5) * CS, 0, c.z + (r() - 0.5) * CS); q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5)); const len = 0.1 + r() * 0.3; s.set(1, len, 1); m4.compose(v, q, s); stalks.setMatrixAt(nst, m4); v.y += len; s.setScalar(0.02 + r() * 0.03); m4.compose(v, q, s); caps.setMatrixAt(nst++, m4); }
  }
  // collapsed escape + corridor ceiling bulbs
  shelves.count = ns; bulbs.count = nb; stalks.count = nst; caps.count = nst;
  for (const im of [shelves, bulbs, stalks, caps]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  const myGeo = new THREE.BufferGeometry(); myGeo.setAttribute('position', new THREE.Float32BufferAttribute(myceliumPts, 3));
  scene.add(new THREE.LineSegments(myGeo, new THREE.LineBasicMaterial({ color: 0xefe6d2, transparent: true, opacity: 0.5 })));

  // tendrils: fibrous strands spanning between pillars / ceiling in the nest, and following pipes elsewhere
  const tendrilMat = new THREE.MeshStandardMaterial({ color: 0xb08858, roughness: 0.6 });
  const fineMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5, transparent: true, opacity: 0.75 });
  const addTendril = (a, b, sag, radius, mat) => {
    const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
    const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).add(new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3)), mid, mid.clone().lerp(b, 0.5), b]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, radius, 5, false), mat); m.castShadow = true; scene.add(m);
    world.tendrils.push({ mesh: m, base: m.position.clone(), mid, phase: r() * 10, amp: 0 });
  };
  for (let i = 0; i < 70; i++) {
    const x0 = 38 + r() * 24, z0 = 17 + r() * 8.5; const c0 = center(x0 | 0, z0 | 0);
    const a = new THREE.Vector3(c0.x + (r() - 0.5) * 2, WALL_H - 0.05, c0.z + (r() - 0.5) * 2);
    const b = new THREE.Vector3(a.x + (r() - 0.5) * 8, r() < 0.5 ? WALL_H - 0.05 : 0.05, a.z + (r() - 0.5) * 6);
    addTendril(a, b, 0.5 + r() * 1.5, 0.015 + r() * (i % 4 === 0 ? 0.06 : 0.02), i % 3 ? tendrilMat : fineMat);
  }
  for (let i = 0; i < 20; i++) { // corridor + escape strands
    const zone = r() < 0.5 ? [26 + r() * 11, 7 + r() * 4] : [15 + r() * 21, 21 + r() * 4];
    const c0 = { x: zone[0] * CS, z: zone[1] * CS }; const a = new THREE.Vector3(c0.x, WALL_H - 0.05, c0.z); const b = new THREE.Vector3(c0.x + (r() - 0.5) * 4, WALL_H - 0.05, c0.z + (r() - 0.5) * 2);
    addTendril(a, b, 0.3 + r() * 1.2, 0.012 + r() * 0.02, fineMat);
  }

  // corpses fused into walls
  const corpseSpots = [[34, 9, 1, 0], [52, 17, 0, -1], [62, 22, 1, 0], [40, 25, 0, 1], [49, 17, 0, -1], [58, 25, 0, 1]];
  for (const [x, z, nx, nz] of corpseSpots) {
    const c = center(x, z); const wallX = c.x + (nx ? nx * CS / 2 : 0), wallZ = c.z + (nz ? nz * CS / 2 : 0);
    const g = new THREE.Group(); g.position.set(wallX - nx * 0.25, 0, wallZ - nz * 0.25); g.rotation.y = Math.atan2(-nx, -nz); scene.add(g);
    const flesh = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.9 }), cloth = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 1 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 4, 8), cloth); torso.position.set(0, 1.25, -0.1); torso.rotation.x = -0.2; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), flesh); head.position.set(0.05, 1.72, -0.05); g.add(head);
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 6), cloth); arm.position.set(sx * 0.32, 1.45, -0.12); arm.rotation.z = sx * 2.3; g.add(arm); const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.6, 4, 6), cloth); leg.position.set(sx * 0.12, 0.55, 0.05); leg.rotation.x = 0.3; g.add(leg); }
    for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(bulbGeo(), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc89a60 : 0xe8d4b0, roughness: 0.6, map: T.fungus })); const bs = 0.08 + r() * 0.2; b.scale.set(bs, bs, bs * 0.6); b.position.set((r() - 0.5) * 0.7, 0.9 + r() * 1.1, -0.2 + r() * 0.2); g.add(b); }
    world.corpses.push({ pos: new THREE.Vector3(g.position.x, 1.4, g.position.z), cool: 0 });
  }
}
