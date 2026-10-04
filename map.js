// Explored-area map: cells are revealed by line of sight as Wren moves, then drawn as an ink sketch on paper.
import * as L from './level.js';

const NAMES = { street: 'ELM STREET', pharmacy: 'PHARMACY', corridor: 'SERVICE CORRIDOR', apartment: 'APARTMENTS', nest: 'THE NEST', escape: 'TUNNEL', outside: 'YARD' };

export function createMap() {
  const seen = new Uint8Array(L.W * L.H);
  let t = 0;
  function reveal(px, pz, dt, radius = 6) {
    t -= dt; if (t > 0) return; t = 0.25;
    const [cx, cz] = L.cellOf(px, pz); const c0 = L.center(cx, cz);
    for (let z = Math.max(0, cz - radius); z <= Math.min(L.H - 1, cz + radius); z++)
      for (let x = Math.max(0, cx - radius); x <= Math.min(L.W - 1, cx + radius); x++) {
        const i = L.idx(x, z); if (seen[i]) continue;
        if ((x - cx) ** 2 + (z - cz) ** 2 > radius * radius) continue;
        const c = L.center(x, z);
        // walls count as seen when an adjacent open cell is visible, so rooms get outlines
        if (L.tile(x, z) === '#') continue;
        if (Math.abs(x - cx) + Math.abs(z - cz) <= 1 || L.losClear(c0.x, c0.z, c.x, c.z)) seen[i] = 1;
      }
  }
  // compact persistence: run-length string of 0/1
  function save() { let s = '', cur = seen[0], n = 0; for (let i = 0; i < seen.length; i++) { if (seen[i] === cur) n++; else { s += n.toString(36) + '.'; cur = seen[i]; n = 1; } } return (seen[0] ? '1' : '0') + ':' + s + n.toString(36); }
  function load(str) {
    seen.fill(0); if (!str) return;
    const [first, body] = str.split(':'); let v = first === '1' ? 1 : 0, i = 0;
    for (const part of body.split('.')) { const n = parseInt(part, 36) || 0; seen.fill(v, i, Math.min(seen.length, i + n)); i += n; v ^= 1; }
  }
  const isSeen = (x, z) => x >= 0 && z >= 0 && x < L.W && z < L.H && seen[L.idx(x, z)] === 1;
  function pct() { let open = 0, s = 0; for (let z = 0; z < L.H; z++) for (let x = 0; x < L.W; x++) if (L.tile(x, z) !== '#') { open++; if (seen[L.idx(x, z)]) s++; } return open ? s / open : 0; }

  // draw onto a canvas: paper, pencil hatching for floors, ink for walls
  function draw(cv, { player, yaw, target, areaId, time = 0 }) {
    const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
    const pad = 40, s = Math.min((W - pad * 2) / L.W, (H - pad * 2) / L.H); const ox = (W - s * L.W) / 2, oz = (H - s * L.H) / 2;
    g.clearRect(0, 0, W, H);
    const X = (x) => ox + x * s, Z = (z) => oz + z * s;
    // floors
    for (let z = 0; z < L.H; z++) for (let x = 0; x < L.W; x++) {
      if (!isSeen(x, z)) continue; const tl = L.tile(x, z);
      g.fillStyle = tl === 'f' ? 'rgba(150,95,40,0.42)' : tl === 'w' ? 'rgba(70,90,110,0.22)' : tl === 'H' || tl === 'M' ? 'rgba(60,50,40,0.35)' : 'rgba(60,50,35,0.12)';
      g.fillRect(X(x), Z(z), s + 0.5, s + 0.5);
      if (tl === 'O' || tl === 'P') { g.strokeStyle = 'rgba(40,30,20,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(X(x) + 3, Z(z) + 3); g.lineTo(X(x) + s - 3, Z(z) + s - 3); g.moveTo(X(x) + s - 3, Z(z) + 3); g.lineTo(X(x) + 3, Z(z) + s - 3); g.stroke(); }
    }
    // pencil hatch over explored floor
    g.save(); g.beginPath(); for (let z = 0; z < L.H; z++) for (let x = 0; x < L.W; x++) if (isSeen(x, z)) g.rect(X(x), Z(z), s + 0.5, s + 0.5); g.clip();
    g.strokeStyle = 'rgba(70,55,35,0.10)'; g.lineWidth = 1; for (let k = -H; k < W; k += 7) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.stroke(); }
    g.restore();
    // walls: ink edges between seen open cells and walls / unseen-blocked cells
    g.strokeStyle = '#2b2218'; g.lineWidth = Math.max(2, s * 0.16); g.lineCap = 'round'; g.beginPath();
    const hsh = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return (v - Math.floor(v)) - 0.5; };
    const V = (vx, vz) => [X(vx) + hsh(vx, vz) * 1.6, Z(vz) + hsh(vz + 0.37, vx + 0.71) * 1.6]; // hand-drawn wobble, stable per vertex
    const seg = (ax, az, bx, bz) => { const a = V(ax, az), b = V(bx, bz); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); };
    const wall = (xx, zz) => xx < 0 || zz < 0 || xx >= L.W || zz >= L.H || L.tile(xx, zz) === '#' || L.tile(xx, zz) === 'W';
    for (let z = 0; z < L.H; z++) for (let x = 0; x < L.W; x++) {
      if (!isSeen(x, z)) continue;
      if (wall(x, z - 1)) seg(x, z, x + 1, z);
      if (wall(x, z + 1)) seg(x, z + 1, x + 1, z + 1);
      if (wall(x - 1, z)) seg(x, z, x, z + 1);
      if (wall(x + 1, z)) seg(x + 1, z, x + 1, z + 1);
    }
    g.stroke();
    // doors
    for (const d of L.doors.values()) {
      if (!isSeen(d.x, d.z) && !isSeen(d.x - 1, d.z) && !isSeen(d.x + 1, d.z) && !isSeen(d.x, d.z - 1) && !isSeen(d.x, d.z + 1)) continue;
      g.fillStyle = d.kind === 'E' ? '#a0221c' : d.kind === 'L' ? '#8a5a20' : '#5a4630'; g.fillRect(X(d.x) + s * 0.2, Z(d.z) + s * 0.2, s * 0.6, s * 0.6);
      if (d.kind === 'E') { g.font = `700 ${Math.max(9, s * 0.42)}px Helvetica`; g.fillText('EXIT', X(d.x) - s * 1.6, Z(d.z) + s * 0.65); }
    }
    // area labels (once any cell of the area is seen)
    g.font = `600 ${Math.max(10, s * 0.48)}px Helvetica`; g.fillStyle = 'rgba(43,34,24,0.75)'; g.textAlign = 'center';
    for (const a of L.AREAS) {
      let any = false; for (let z = a.z0; z <= a.z1 && !any; z++) for (let x = a.x0; x <= a.x1; x++) if (isSeen(x, z)) { any = true; break; }
      if (!any) continue; const lx = X((a.x0 + a.x1 + 1) / 2), lz = Z(a.z0 < 1 ? a.z0 + 1.2 : a.z0 + 0.9);
      g.fillText(NAMES[a.id] || a.id.toUpperCase(), lx, lz);
    }
    g.textAlign = 'left';
    // objective marker
    if (target) {
      const [tx, tz] = target; const cx = X(tx + 0.5), cz = Z(tz + 0.5); const r = s * (0.55 + 0.1 * Math.sin(time * 4));
      g.strokeStyle = '#a0221c'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cz, r, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cz, r * 1.7, 0, Math.PI * 2); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1;
    }
    // player arrow
    if (player) {
      const px = ox + (player.x / L.CS) * s, pz = oz + (player.z / L.CS) * s;
      g.save(); g.translate(px, pz); g.rotate(-yaw + Math.PI); g.fillStyle = '#1d4a7a'; g.strokeStyle = '#efe6d0'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -s * 0.75); g.lineTo(s * 0.48, s * 0.5); g.lineTo(0, s * 0.22); g.lineTo(-s * 0.48, s * 0.5); g.closePath(); g.stroke(); g.fill(); g.restore();
    }
  }
  return { reveal, save, load, draw, pct, seen };
}
