// Scavenged melee weapons: stats, durability rules and procedural PBR models.
// Original designs in a grounded, improvised style (see WEAPONS.md for the design notes).
import * as THREE from 'three';

export const MELEE = {
  nailboard: { name: 'Nailboard', kind: 'blunt', dmg: 1, stagger: 2.2, swing: 0.8, reach: 1.9, dur: 5, noise: 6, knock: 0.9, parry: false,
    blurb: 'A 2x4 with bent framing nails. Two swings to drop a Frenzied, and each one floors it.' },
  machete: { name: 'Gutter Machete', kind: 'blade', dmg: 1, stagger: 0.8, swing: 0.55, reach: 1.8, dur: 8, noise: 4, knock: 0.4, parry: false, bleed: true,
    blurb: 'A street sign ground to an edge, riveted to pipe. Fast and quiet; the wound finishes what the swing starts.' },
  brushblade: { name: 'Brush Blade', kind: 'blade', dmg: 2, stagger: 1.6, swing: 0.85, reach: 2.2, dur: 7, noise: 5, knock: 0.7, parry: false, cleave: true,
    blurb: 'A hooked clearing blade on an ash handle. Slow, wide arcs that catch two infected at once.' },
  saber: { name: 'Pawnshop Saber', kind: 'blade', dmg: 2, stagger: 1.0, swing: 0.62, reach: 2.3, dur: 6, noise: 4, knock: 0.5, parry: true,
    blurb: 'A decorative replica someone sharpened on a curb. Long reach, one clean cut, and a swing timed into a lunge deflects it. The steel is cheap — it will snap.' },
};

const TL = new THREE.TextureLoader();
function tex(name) { const t = TL.load(`assets/tex/${name}.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function noise(g, w, h, a, n = 900) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); } }

let mats = null;
function materials() {
  if (mats) return mats;
  const metal = tex('metal');
  const sign = canvasTex(512, 128, (g, w, h) => { // reflective green road-sign paint, ground away near the edge
    g.fillStyle = '#9a9c98'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f5a3a'; g.fillRect(0, h * 0.28, w, h * 0.72);
    g.fillStyle = '#e8e6dc'; g.font = 'bold 70px Arial'; g.fillText('ELM ST', 70, h * 0.92);
    g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.8})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 2 + Math.random() * 6); }
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#8e8f8a'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(110,60,25,0.35)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, Math.random() * 10);
    g.fillStyle = 'rgba(220,220,215,0.9)'; g.fillRect(0, 0, w, h * 0.12); noise(g, w, h, 0.25);
  });
  const wood = canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#9c7a52'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(${70 + Math.random() * 30},${45 + Math.random() * 20},25,${0.3 + Math.random() * 0.4})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); for (let x = 0; x < w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4); g.stroke(); }
    g.fillStyle = 'rgba(60,20,10,0.5)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(w * 0.62 + Math.random() * w * 0.36, Math.random() * h, 3 + Math.random() * 9, 0, 7); g.fill(); } // old stains near the striking end
    noise(g, w, h, 0.2);
  });
  const wrap = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#1b1b1d'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 10) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y, w, 2); } noise(g, w, h, 0.15, 300); });
  const cord = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#3a2a22'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { g.strokeStyle = 'rgba(200,170,130,0.35)'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 6); g.stroke(); } });
  wrap.wrapS = wrap.wrapT = cord.wrapS = cord.wrapT = THREE.RepeatWrapping;
  mats = {
    sign: new THREE.MeshStandardMaterial({ map: sign, metalness: 0.65, roughness: 0.42, side: THREE.DoubleSide }),
    edge: new THREE.MeshStandardMaterial({ color: 0xd8d8d4, metalness: 1, roughness: 0.18 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, map: metal, metalness: 0.95, roughness: 0.28 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0x6a6460, map: metal, metalness: 0.8, roughness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.9, roughness: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }),
    nail: new THREE.MeshStandardMaterial({ color: 0x8a7a6a, metalness: 0.8, roughness: 0.45 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x6a3a1e, metalness: 0.5, roughness: 0.8 }),
    wrap: new THREE.MeshStandardMaterial({ map: wrap, roughness: 0.95 }),
    tape: new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.7 }),
    cord: new THREE.MeshStandardMaterial({ map: cord, roughness: 1 }),
  };
  return mats;
}

const shade = (o) => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// All models: grip centred on the origin, blade/head extending along +Z (same frame as the pistol barrel).
export function buildMelee(id) {
  const M = materials(); const g = new THREE.Group(); g.name = id;
  if (id === 'machete') {
    const s = new THREE.Shape(); // blade profile in the x(width)/y(length) plane, spine straight, belly swelling to a clipped tip
    s.moveTo(-0.018, 0); s.lineTo(0.02, 0); s.lineTo(0.03, 0.12); s.quadraticCurveTo(0.042, 0.34, 0.028, 0.43); s.lineTo(-0.012, 0.46); s.lineTo(-0.02, 0.42); s.lineTo(-0.018, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0016, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0, 0, -0.0015); geo.rotateX(Math.PI / 2); // profile length (y) → +z
    geo.computeVertexNormals();
    const uv = geo.attributes.uv; const pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getZ(i) / 0.46, (pos.getX(i) + 0.03) / 0.075);
    const blade = new THREE.Mesh(geo, M.sign); blade.position.z = 0.07; g.add(blade);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.0035, 0.38), M.edge); edge.position.set(0.031, 0, 0.32); edge.rotation.y = -0.03; g.add(edge);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.15, 14), M.pipe); pipe.rotation.x = Math.PI / 2; pipe.position.z = -0.01; g.add(pipe);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0195, 0.12, 14), M.wrap); grip.rotation.x = Math.PI / 2; grip.position.z = -0.02; grip.material.map.repeat.set(1, 1); g.add(grip);
    for (const z of [0.075, 0.1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), M.brass); r.rotation.z = Math.PI / 2; r.position.set(0, 0, z); g.add(r); }
  } else if (id === 'nailboard') {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.78), M.wood); board.position.z = 0.29; g.add(board);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.16), M.tape); grip.position.z = -0.02; g.add(grip);
    for (let i = 0; i < 9; i++) { // framing nails punched through near the head, a few bent over
      const n = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.07, 5), i % 3 ? M.nail : M.rust); shaft.position.y = 0.035; n.add(shaft);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 8), M.nail); n.add(head);
      const side = i % 2 ? 1 : -1; n.position.set((Math.random() - 0.5) * 0.05, side * 0.02, 0.45 + Math.random() * 0.22); if (side < 0) n.rotation.x = Math.PI;
      n.rotation.z = (Math.random() - 0.5) * 0.5; if (i % 4 === 0) shaft.rotation.z = 0.9; g.add(n);
    }
  } else if (id === 'brushblade') { // hooked clearing blade on a long ash handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.62, 10), M.wood); handle.rotation.x = Math.PI / 2; handle.position.z = 0.18; g.add(handle);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.12, 10), M.wrap); wrap.rotation.x = Math.PI / 2; wrap.position.z = -0.06; g.add(wrap);
    const s = new THREE.Shape(); // broad blade with a forward hook at the tip
    s.moveTo(0, 0); s.lineTo(0.0, 0.3); s.quadraticCurveTo(0.005, 0.38, 0.05, 0.4); s.quadraticCurveTo(0.075, 0.37, 0.06, 0.33); s.quadraticCurveTo(0.075, 0.18, 0.06, 0.02); s.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.002, bevelSegments: 1, curveSegments: 10 });
    geo.translate(-0.01, 0, -0.002); geo.rotateX(Math.PI / 2); geo.computeVertexNormals();
    const blade = new THREE.Mesh(geo, M.steel); blade.position.z = 0.46; g.add(blade);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), M.pipe); ferrule.rotation.x = Math.PI / 2; ferrule.position.z = 0.47; g.add(ferrule);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.005, 0.3), M.edge); edge.position.set(0.062, 0, 0.62); g.add(edge);
  } else { // saber: gentle curve, brass guard, cord grip
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(0.035 * t * t, 0, 0.08 + t * 0.72)); }
    const curve = new THREE.CatmullRomCurve3(pts); const N = 40, w0 = 0.026;
    const verts = [], idx = [], uvs = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N; const p = curve.getPoint(t); const w = t > 0.9 ? w0 * (1 - (t - 0.9) / 0.1) * 0.9 + 0.001 : w0 * (1 - t * 0.25);
      verts.push(p.x - w * 0.5, 0.0035, p.z, p.x + w * 0.5, 0, p.z, p.x - w * 0.5, -0.0035, p.z); uvs.push(0, t, 1, t, 0, t);
      if (i < N) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 2, a + 1, a + 5, a + 1, a + 4, a + 5, a, a + 2, a + 3, a + 2, a + 5, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, M.steel));
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI), M.brass); guard.rotation.set(0, Math.PI / 2, Math.PI / 2); guard.position.set(0, 0, 0.065); g.add(guard);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), M.brass); plate.position.z = 0.075; g.add(plate);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.14, 12), M.cord); grip.rotation.x = Math.PI / 2; grip.position.z = 0; g.add(grip);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), M.brass); pommel.position.z = -0.075; g.add(pommel);
  }
  return shade(g);
}
