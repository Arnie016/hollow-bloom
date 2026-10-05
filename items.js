// Item catalogue: metadata, procedural PBR meshes (used in the world AND for inventory icons),
// and an offscreen renderer that turns those meshes into icons so the backpack shows real objects.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MELEE, buildMelee } from './weapons.js';
import { prop } from './assets.js';

export const ITEMS = {
  pistol:  { name: 'Pistol', cat: 'Weapon', desc: 'A scuffed 9mm. Loud enough to wake the whole block. Every round counts.' },
  knife:   { name: 'Pocket Knife', cat: 'Weapon', desc: 'Short, quiet, always there. Silent takedowns from behind.' },
  nailboard: { name: MELEE.nailboard.name, cat: 'Melee', desc: MELEE.nailboard.blurb },
  machete:   { name: MELEE.machete.name, cat: 'Melee', desc: MELEE.machete.blurb },
  saber:     { name: MELEE.saber.name, cat: 'Melee', desc: MELEE.saber.blurb },
  brushblade: { name: 'Brush Blade', cat: 'Melee', desc: 'A long hooked clearing blade from the workshop. Heavy arcs that catch two at once.' },
  bottle:  { name: 'Bottle', cat: 'Throwable', desc: 'Throw it to pull infected toward the crash. Knockers chase the sound.' },
  brick:   { name: 'Brick', cat: 'Throwable', desc: 'A dull thud on impact. Stuns anything it hits.' },
  molotov: { name: 'Molotov', cat: 'Throwable', desc: 'Rag, alcohol, glass. Burns anything standing in it — including you.' },
  kit:     { name: 'Health Kit', cat: 'Supplies', desc: 'Antiseptic and a clean wrap. Restores half your health. Takes a few seconds.' },
  shiv:    { name: 'Shiv', cat: 'Supplies', desc: 'One use. The only way to take a Knocker down quietly.' },
  ammo:    { name: 'Pistol Rounds', cat: 'Supplies', desc: 'Loose 9mm rounds. Reload with R.' },
  med:     { name: 'Clinic Supplies', cat: 'Key item', desc: 'Antibiotics, sutures, gauze. What you came for.' },
  cloth:   { name: 'Rag', cat: 'Material', desc: 'Torn flannel. Crafts health kits and molotovs.' },
  alcohol: { name: 'Alcohol', cat: 'Material', desc: 'Half a bottle of something strong. Crafts health kits and molotovs.' },
  blade:   { name: 'Blade', cat: 'Material', desc: 'A snapped utility blade. Crafts shivs.' },
  binding: { name: 'Binding', cat: 'Material', desc: 'Duct tape. Crafts shivs and repairs melee weapons.' },
  scrap:   { name: 'Scrap', cat: 'Material', desc: 'Springs, bolts, a bent bracket. Upgrades weapons at a workbench.' },
  notes:   { name: 'Notes', cat: 'Journal', desc: 'Things people left behind.' },
  map:     { name: 'Map', cat: 'Journal', desc: 'Your sketch of the building, filled in as you explore. (M)' },
};

const TEX = {};
function canvasTex(key, w, h, draw) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (TEX[key] = t);
}
function grain(g, w, h, a = 0.18, n = 1200) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
const std = (o) => new THREE.MeshStandardMaterial(o);
const glass = (color, op = 0.55) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transparent: true, opacity: op, clearcoat: 1, clearcoatRoughness: 0.1 });

function bottleGeo(h = 0.26, r = 0.038) {
  const pts = [[0, 0], [r * 0.92, 0], [r, h * 0.04], [r, h * 0.55], [r * 0.85, h * 0.66], [r * 0.38, h * 0.78], [r * 0.32, h * 0.94], [r * 0.36, h * 0.96], [r * 0.34, h], [0, h]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 20);
}
function label(key, bg, fg, text, sub = '') {
  return canvasTex('lbl_' + key, 256, 128, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = 'bold 40px Georgia'; g.textAlign = 'center'; g.fillText(text, w / 2, 62); g.font = '20px Georgia'; g.fillText(sub, w / 2, 96); grain(g, w, h, 0.25, 900); g.fillStyle = 'rgba(80,50,20,0.25)'; g.fillRect(0, 0, w * 0.3, h); });
}
function shadeAll(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

// Builds a real-scale model (metres), resting on y=0, roughly centred in x/z.
export function buildItem(kind) {
  const g = new THREE.Group(); g.name = 'item_' + kind;
  if (MELEE[kind]) { g.add(buildMelee(kind)); g.userData.flat = true; return shadeAll(g); } // blade along +z, lying flat
  switch (kind) {
    case 'pistol': { const p = prop('survival-pistol-original', { size: [0.05, 0.17, 0.24] }) || prop('pistol', { size: [0.05, 0.17, 0.24] }); if (p) g.add(p); else g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.2), std({ color: 0x151515, metalness: 0.7, roughness: 0.4 }))); break; }
    case 'knife': { const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.09), std({ color: 0xc8c8c8, metalness: 1, roughness: 0.22 })); b.position.set(0, 0.006, 0.07); const h = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.1), std({ color: 0x2a2420, roughness: 0.6 })); h.position.set(0, 0.006, -0.02); g.add(b, h); g.userData.flat = true; break; }
    case 'bottle': case 'molotov': {
      const b = new THREE.Mesh(bottleGeo(), glass(kind === 'molotov' ? 0x7a4a1e : 0x2f6a40, 0.62)); g.add(b);
      const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.0385, 0.0385, 0.07, 20, 1, true), std({ map: kind === 'molotov' ? label('whisky', '#d8c8a0', '#3a2414', 'RYE', 'NO. 7') : label('soda', '#c84a2a', '#f4e8d0', 'FIZZ', 'COLA'), roughness: 0.8 }));
      lb.position.y = 0.09; g.add(lb);
      if (kind === 'molotov') { const rag = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 7), std({ map: flannel(), roughness: 1 })); rag.position.y = 0.29; rag.rotation.z = 0.25; g.add(rag); const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.07), std({ map: flannel(), roughness: 1 })); tail.position.set(0.02, 0.27, 0.02); tail.rotation.set(0.6, 0.3, 0.9); g.add(tail); }
      break;
    }
    case 'brick': { const tex = canvasTex('brick', 256, 128, (c, w, h) => { c.fillStyle = '#8a3e28'; c.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(${40 + Math.random() * 60},${15 + Math.random() * 20},10,${Math.random() * 0.5})`; c.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 20, 2 + Math.random() * 8); } c.fillStyle = 'rgba(200,190,170,0.5)'; c.fillRect(0, h - 10, w, 10); grain(c, w, h, 0.3, 1500); });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.065, 0.1), std({ map: tex, roughness: 0.95 }))); g.children[0].position.y = 0.0325; break; }
    case 'cloth': { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14, 6, 1, 4), std({ map: flannel(), roughness: 1 })); const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 40) * 0.004 + Math.cos(p.getZ(i) * 30) * 0.003); m.geometry.computeVertexNormals(); m.position.y = 0.012; g.add(m);
      const fold = m.clone(); fold.scale.set(0.9, 1, 0.5); fold.position.set(0.01, 0.03, -0.02); fold.rotation.y = 0.2; g.add(fold); break; }
    case 'alcohol': { const b = new THREE.Mesh(bottleGeo(0.24, 0.04), glass(0x8a5a2a, 0.6)); g.add(b); const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.08, 20, 1, true), std({ map: label('alc', '#e8e4d8', '#7a1a14', '70%', 'ISOPROPYL'), roughness: 0.8 })); lb.position.y = 0.08; g.add(lb); const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 12), std({ color: 0x1a3a7a, roughness: 0.5 })); cap.position.y = 0.245; g.add(cap); break; }
    case 'blade': { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.06, 0); s.lineTo(0.075, 0.018); s.lineTo(0.012, 0.018); s.lineTo(0, 0); const geo = new THREE.ExtrudeGeometry(s, { depth: 0.0015, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(-0.037, 0.001, 0.009);
      g.add(new THREE.Mesh(geo, std({ color: 0xc4c8cc, metalness: 1, roughness: 0.28 }))); g.userData.flat = true; break; }
    case 'binding': { const tape = canvasTex('tape', 256, 32, (c, w, h) => { c.fillStyle = '#8c8e90'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 3) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; c.fillRect(x, 0, 1, h); } grain(c, w, h, 0.2, 400); });
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.045, 28, 1, true), std({ map: tape, metalness: 0.3, roughness: 0.45, side: THREE.DoubleSide })); outer.position.y = 0.0225;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.055, 28), std({ color: 0x6e7072, roughness: 0.5, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.045;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.046, 20, 1, true), std({ color: 0xa88a5e, roughness: 0.9, side: THREE.DoubleSide })); core.position.y = 0.023;
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.05), std({ map: tape, roughness: 0.5, side: THREE.DoubleSide })); tail.position.set(0.055, 0.02, 0.02); tail.rotation.set(0.2, 1.2, 0); g.add(outer, ring, core, tail); break; }
    case 'kit': { const red = std({ color: 0xa0221c, roughness: 0.75 }); const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.11), red); pouch.position.y = 0.035;
      const crossT = canvasTex('cross', 128, 128, (c, w, h) => { c.fillStyle = '#a0221c'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0ece0'; c.fillRect(48, 20, 32, 88); c.fillRect(20, 48, 88, 32); grain(c, w, h, 0.25, 500); });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11), std({ map: crossT, roughness: 0.8 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.0705;
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.008, 0.008), std({ color: 0x222222, roughness: 0.4, metalness: 0.4 })); zip.position.set(0, 0.06, 0.055);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.072, 0.115), std({ color: 0x2a2a28, roughness: 0.9 })); strap.position.set(-0.05, 0.036, 0);
      g.add(pouch, top, zip, strap); break; }
    case 'shiv': { const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, 0.085), std({ color: 0xbcc0c4, metalness: 1, roughness: 0.3 })); b.position.set(0, 0.008, 0.06);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0075, 0.03, 4), b.material); tip.rotation.x = Math.PI / 2; tip.position.set(0, 0.008, 0.115); tip.scale.set(1, 1, 0.3);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.013, 0.09, 10), std({ color: 0x8c8e90, roughness: 0.5, metalness: 0.2 })); h.rotation.x = Math.PI / 2; h.position.set(0, 0.012, -0.01); g.add(b, tip, h); g.userData.flat = true; break; }
    case 'ammo': { const box = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.05), std({ map: label('ammo', '#5a5a3a', '#e8e0c0', '9MM', '50 CTG'), roughness: 0.85 })); box.position.y = 0.0175; g.add(box);
      const brass = std({ color: 0xc89a4a, metalness: 1, roughness: 0.3 }), lead = std({ color: 0x8a8a8a, metalness: 0.8, roughness: 0.4 });
      for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.019, 10), brass); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lead); tip.position.y = 0.0095; c.add(tip); c.position.set(-0.06 + i * 0.012, 0.0095, 0.045 - (i % 2) * 0.012); if (i > 1) { c.rotation.z = Math.PI / 2; c.position.y = 0.005; } g.add(c); }
      break; }
    case 'med': { const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.26), std({ map: label('med', '#e8e6dc', '#a0221c', '✚ CLINIC', 'ANTIBIOTICS · STERILE'), roughness: 0.7 })); body.position.y = 0.11; g.add(body);
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.01), std({ color: 0x888888, metalness: 0.9, roughness: 0.3 })); latch.position.set(0, 0.19, 0.132); g.add(latch); break; }
    case 'scrap': { const m = std({ color: 0x7a7470, metalness: 0.85, roughness: 0.45 }), rust = std({ color: 0x7a4426, metalness: 0.4, roughness: 0.8 });
      const spring = new THREE.Mesh(new THREE.TorusKnotGeometry(0.014, 0.003, 60, 6, 1, 6), m); spring.position.set(-0.02, 0.016, 0); spring.scale.set(1, 1, 2.2);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), m); bolt.rotation.z = Math.PI / 2; bolt.position.set(0.03, 0.007, 0.02);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 6), rust); nut.position.set(0.035, 0.004, -0.025);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.02), rust); bracket.position.set(0, 0.002, -0.03); bracket.rotation.y = 0.5; g.add(spring, bolt, nut, bracket); break; }
    case 'notes': { const paper = canvasTex('paper', 256, 320, (c, w, h) => { c.fillStyle = '#e4dcc6'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(40,40,80,0.55)'; c.lineWidth = 2; for (let y = 40; y < h - 20; y += 22) { c.beginPath(); let x = 20; c.moveTo(x, y); while (x < w - 30) { x += 6 + Math.random() * 10; c.lineTo(x, y + (Math.random() - 0.5) * 3); } c.stroke(); } c.fillStyle = 'rgba(120,80,30,0.25)'; c.beginPath(); c.arc(w * 0.7, h * 0.7, 40, 0, 7); c.fill(); grain(c, w, h, 0.2, 900); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), std({ map: paper, roughness: 0.95, side: THREE.DoubleSide })); s.rotation.x = -Math.PI / 2; s.position.y = 0.002; s.rotation.z = 0.2; g.add(s); g.userData.flat = true; break; }
    case 'map': { const t = canvasTex('mapicon', 256, 256, (c, w, h) => { c.fillStyle = '#d8ccae'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a3226'; c.lineWidth = 5; c.strokeRect(30, 40, 90, 70); c.strokeRect(120, 40, 100, 120); c.strokeRect(40, 150, 80, 70); c.strokeStyle = '#a0221c'; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(60, 200); c.lineTo(70, 80); c.lineTo(180, 100); c.stroke(); for (let x = 85; x < w; x += 85) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, 0, 3, h); } grain(c, w, h, 0.22, 1400); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), std({ map: t, roughness: 0.9, side: THREE.DoubleSide })); s.rotation.x = -Math.PI / 2; s.position.y = 0.002; g.add(s); g.userData.flat = true; break; }
    default: g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), std({ color: 0x888888 })));
  }
  return shadeAll(g);
}
function flannel() {
  return canvasTex('flannel', 128, 128, (c, w, h) => { c.fillStyle = '#7a2a22'; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 32) { c.fillStyle = 'rgba(20,20,30,0.55)'; c.fillRect(i, 0, 10, h); c.fillRect(0, i, w, 10); c.fillStyle = 'rgba(220,200,170,0.25)'; c.fillRect(i + 18, 0, 3, h); c.fillRect(0, i + 18, w, 3); } grain(c, w, h, 0.25, 900); });
}

// Render each item to a transparent PNG data URL with a consistent studio look.
export function renderIcons(kinds, size = 192) {
  const out = {};
  let r;
  try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return out; }
  r.setPixelRatio(1); r.setSize(size, size); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15; r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(); const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff2e0, 2.4); key.position.set(-1.5, 2.2, 1.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xa8c4ff, 1.6); rim.position.set(1.8, 1.0, -1.6); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 20);
  for (const kind of kinds) {
    const holder = new THREE.Group(); const obj = buildItem(kind); holder.add(obj); scene.add(holder);
    if (obj.userData.flat) { holder.rotation.set(0.9, 0.7, 0); } else { holder.rotation.set(0.32, -0.62, 0); }
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder); const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
    holder.position.sub(c);
    const rad = Math.max(s.x, s.y, s.z) * 0.62; const dist = rad / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.05;
    cam.position.set(0, 0, dist); cam.lookAt(0, 0, 0); cam.near = dist / 50; cam.far = dist * 10; cam.updateProjectionMatrix();
    r.render(scene, cam); out[kind] = r.domElement.toDataURL('image/png');
    scene.remove(holder);
  }
  pm.dispose(); r.dispose(); r.forceContextLoss?.();
  return out;
}
