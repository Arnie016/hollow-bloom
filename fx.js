// Rain, particles (spores, dust, glass, blood), decals, falling debris.
import * as THREE from 'three';
import * as L from './level.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    // rain over the outdoor areas
    this.rain = [];
    for (const a of L.AREAS.filter(a => a.outside)) {
      const n = 1400, pos = new Float32Array(n * 6); const x0 = (a.x0 + 1) * L.CS, x1 = (a.x1 + 1) * L.CS, z0 = (a.z0 + 1) * L.CS, z1 = (a.z1 + 1) * L.CS;
      for (let i = 0; i < n; i++) { const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0), y = Math.random() * 9; pos.set([x, y, z, x - 0.02, y - 0.35, z], i * 6); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9aaab8, transparent: true, opacity: 0.35 })); m.frustumCulled = false; scene.add(m);
      this.rain.push({ m, pos, n });
    }
    // generic particle pool
    this.N = 1600; this.pp = new Float32Array(this.N * 3); this.pc = new Float32Array(this.N * 3); this.pv = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.grav = new Float32Array(this.N); this.head = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pp, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.pc, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32; const cx = c.getContext('2d'); const gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, map: new THREE.CanvasTexture(c), depthWrite: false })); this.points.frustumCulled = false; scene.add(this.points);
    for (let i = 0; i < this.N; i++) this.pp[i * 3 + 1] = -99;
    // ambient spore motes in the nest / corridor
    const sn = 700, sp = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) { const inNest = i < 520; sp[i * 3] = inNest ? (38 + Math.random() * 25) * L.CS : (26 + Math.random() * 12) * L.CS; sp[i * 3 + 1] = Math.random() * L.WALL_H; sp[i * 3 + 2] = inNest ? (17 + Math.random() * 9) * L.CS : (7 + Math.random() * 4) * L.CS; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.motes = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.035, color: 0xffd8a0, transparent: true, opacity: 0.55, map: this.points.material.map, depthWrite: false })); scene.add(this.motes); this.motePos = sp;
    this.decals = []; this.debris = [];
    this.bloodMat = new THREE.MeshStandardMaterial({ color: 0x3a0806, roughness: 0.25, transparent: true, depthWrite: false });
  }
  emit(p, n, { color = [1, 1, 1], spread = 0.5, up = 1, grav = 1, life = 1.5, speed = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const k = this.head = (this.head + 1) % this.N;
      this.pp[k * 3] = p.x + (Math.random() - 0.5) * spread * 0.3; this.pp[k * 3 + 1] = p.y; this.pp[k * 3 + 2] = p.z + (Math.random() - 0.5) * spread * 0.3;
      this.pv[k * 3] = (Math.random() - 0.5) * spread * speed; this.pv[k * 3 + 1] = Math.random() * up * speed; this.pv[k * 3 + 2] = (Math.random() - 0.5) * spread * speed;
      const f = 0.7 + Math.random() * 0.3; this.pc[k * 3] = color[0] * f; this.pc[k * 3 + 1] = color[1] * f; this.pc[k * 3 + 2] = color[2] * f; this.life[k] = life * (0.5 + Math.random()); this.grav[k] = grav;
    }
  }
  spores(p, n = 20) { this.emit(p, n, { color: [1, 0.82, 0.55], spread: 1.2, up: 0.3, grav: -0.02, life: 4, speed: 0.4 }); }
  dust(p, n = 30) { this.emit(p, n, { color: [0.6, 0.57, 0.52], spread: 2, up: 0.4, grav: 0.3, life: 2.5, speed: 0.8 }); }
  glass(p) { this.emit(p, 40, { color: [0.85, 1, 0.95], spread: 3, up: 3, grav: 9, life: 0.8, speed: 1 }); }
  blood(p) { this.emit(p, 26, { color: [0.35, 0.02, 0.02], spread: 2, up: 1.5, grav: 7, life: 0.6, speed: 1.2 }); this.decal(p.x, p.z, 0.25 + Math.random() * 0.3); }
  sparks(p) { this.emit(p, 14, { color: [1, 0.8, 0.4], spread: 3, up: 2, grav: 6, life: 0.3, speed: 1.5 }); }
  splash(p) { this.emit(p, 8, { color: [0.6, 0.7, 0.8], spread: 1, up: 1.2, grav: 8, life: 0.35, speed: 0.8 }); }
  decal(x, z, r) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 12), this.bloodMat.clone()); m.rotation.x = -Math.PI / 2; m.position.set(x + (Math.random() - 0.5) * 0.4, 0.013 + Math.random() * 0.003, z + (Math.random() - 0.5) * 0.4); m.scale.x = 1 + Math.random(); this.scene.add(m); this.decals.push({ m, t: 25 }); }
  clear() { // wipe transient effects (checkpoint restore / new game)
    for (let i = 0; i < this.N; i++) { this.life[i] = 0; this.pp[i * 3 + 1] = -99; }
    this.points.geometry.attributes.position.needsUpdate = true;
    for (const d of this.decals) { this.scene.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); }
    for (const d of this.debris) { this.scene.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); }
    this.decals.length = 0; this.debris.length = 0;
  }
  dropDebris(x, z, size = 0.5) { // ceiling fragment falling with simple physics
    const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.4, size * 0.8), new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 1 })); m.position.set(x, L.WALL_H - 0.2, z); m.castShadow = true; this.scene.add(m);
    this.debris.push({ m, vy: 0, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(4), landed: false }); this.dust(new THREE.Vector3(x, L.WALL_H - 0.3, z), 20);
  }
  update(dt, camPos, onLand) {
    for (const r of this.rain) { const p = r.pos; for (let i = 0; i < r.n; i++) { const b = i * 6; p[b + 1] -= 16 * dt; p[b + 4] -= 16 * dt; if (p[b + 4] < 0) { p[b + 1] += 9; p[b + 4] += 9; } } r.m.geometry.attributes.position.needsUpdate = true; }
    for (let i = 0; i < this.N; i++) { if (this.life[i] <= 0) continue; this.life[i] -= dt; const b = i * 3; this.pv[b + 1] -= this.grav[i] * dt; this.pp[b] += this.pv[b] * dt; this.pp[b + 1] += this.pv[b + 1] * dt; this.pp[b + 2] += this.pv[b + 2] * dt; if (this.pp[b + 1] < 0.01) { this.pp[b + 1] = 0.01; this.pv[b] *= 0.5; this.pv[b + 2] *= 0.5; this.pv[b + 1] = 0; } if (this.life[i] <= 0) this.pp[b + 1] = -99; }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
    const mp = this.motePos, t = performance.now() * 0.001; for (let i = 0; i < mp.length; i += 3) { mp[i + 1] += Math.sin(t * 0.5 + i) * 0.002 + 0.001; mp[i] += Math.cos(t * 0.3 + i) * 0.002; if (mp[i + 1] > L.WALL_H) mp[i + 1] = 0; } this.motes.geometry.attributes.position.needsUpdate = true;
    for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.t -= dt; d.m.material.opacity = Math.min(0.85, d.t / 5); if (d.t <= 0) { this.scene.remove(d.m); this.decals.splice(i, 1); } }
    for (const d of this.debris) { if (d.landed) continue; d.vy -= 9.8 * dt; d.m.position.y += d.vy * dt; d.m.rotation.x += d.spin.x * dt; d.m.rotation.z += d.spin.z * dt; if (d.m.position.y < 0.12) { d.m.position.y = 0.12; d.landed = true; this.dust(d.m.position, 25); onLand?.(d.m.position); } }
  }
}
