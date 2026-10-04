// GLB asset loading, animation retargeting and skinned character instances.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();
export const loaded = { chars: {}, props: {} };
export let MANIFEST = { chars: {}, props: {} };

export function load(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(path).catch(e => { console.warn('asset load failed', path, e.message); return null; }));
  return cache.get(path);
}

// Clips come from separate rigging jobs of the same A-pose mesh. Their bone axes differ from the
// high-poly base rig, so rotations are retargeted in world space: the world-space change from the
// shared A-pose rest is carried over to the base skeleton, then converted back to local rotations.
function skeletonInfo(root) {
  const rest = {}, order = [];
  const walk = (o, parentBone) => {
    for (const c of o.children) {
      if (c.isBone) {
        const pw = parentBone ? rest[parentBone].world : new THREE.Quaternion();
        rest[c.name] = { local: c.quaternion.clone(), world: pw.clone().multiply(c.quaternion), parent: parentBone, pos: c.position.clone() };
        order.push(c.name); walk(c, c.name);
      } else walk(c, parentBone);
    }
  };
  walk(root, null);
  return { rest, order };
}
function retarget(gltf, name, base) {
  if (!gltf?.animations?.length) return null;
  const src = skeletonInfo(gltf.scene), clip = gltf.animations[0];
  const tracks = {};
  for (const t of clip.tracks) { const i = t.name.lastIndexOf('.'); const b = t.name.slice(0, i), p = t.name.slice(i + 1); (tracks[b] ||= {})[p] = t; }
  const ref = tracks.Hips?.quaternion || clip.tracks.find(t => t.name.endsWith('.quaternion')); if (!ref) return null;
  const times = ref.times, N = times.length;
  const interp = {}; for (const b in tracks) { if (tracks[b].quaternion) interp[b] = tracks[b].quaternion.createInterpolant(); }
  const posInterp = tracks.Hips?.position?.createInterpolant();
  const out = {}; for (const b of base.order) out[b] = new Float32Array(N * 4);
  const hipsOut = new Float32Array(N * 3);
  const sw = {}, tw = {}, q = new THREE.Quaternion(), inv = new THREE.Quaternion(), I = new THREE.Quaternion();
  const sH = src.rest.Hips?.pos, tH = base.rest.Hips?.pos; const k = sH && tH ? tH.y / sH.y : 1;
  for (let f = 0; f < N; f++) {
    const t = times[f];
    for (const b of src.order) { // source world rotations for this frame
      const r = src.rest[b]; if (interp[b]) q.fromArray(interp[b].evaluate(t)); else q.copy(r.local);
      sw[b] = (r.parent ? sw[r.parent].clone() : I.clone()).multiply(q);
    }
    for (const b of base.order) {
      const r = base.rest[b]; const pw = r.parent ? tw[r.parent] : I;
      let w;
      if (sw[b] && src.rest[b]) { inv.copy(src.rest[b].world).invert(); w = sw[b].clone().multiply(inv).multiply(r.world); }
      else w = pw.clone().multiply(r.local);
      tw[b] = w;
      q.copy(pw).invert().multiply(w).toArray(out[b], f * 4);
    }
    if (posInterp && sH && tH) { const v = posInterp.evaluate(t); hipsOut[f * 3] = tH.x + (v[0] - sH.x) * k; hipsOut[f * 3 + 1] = tH.y + (v[1] - sH.y) * k; hipsOut[f * 3 + 2] = tH.z + (v[2] - sH.z) * k; }
  }
  const newTracks = base.order.map(b => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, out[b]));
  if (posInterp && sH && tH) newTracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipsOut));
  return new THREE.AnimationClip(name, clip.duration, newTracks);
}

export async function preload(onProgress = () => {}) {
  try { MANIFEST = await (await fetch('assets/manifest.json', { cache: 'no-cache' })).json(); } catch { return loaded; }
  const jobs = [];
  for (const [id, def] of Object.entries(MANIFEST.chars || {})) jobs.push(async () => {
    const base = await load(def.model); if (!base) return;
    const info = skeletonInfo(base.scene);
    const clips = {};
    await Promise.all(Object.entries(def.clips || {}).map(async ([name, path]) => { const g = await load(path); const c = retarget(g, name, info); if (c) clips[name] = c; }));
    loaded.chars[id] = { base, clips, def };
  });
  for (const [id, def] of Object.entries(MANIFEST.props || {})) jobs.push(async () => { const g = await load(def.model); if (g) loaded.props[id] = { scene: g.scene, def }; });
  let done = 0; const total = jobs.length;
  await Promise.all(jobs.map(j => j().then(() => onProgress(++done / total))));
  return loaded;
}

// Instance of a static prop, fitted to a target size (the largest target dimension wins) with feet on the ground.
export function prop(id, { size, height, yaw = 0 } = {}) {
  const p = loaded.props[id]; if (!p) return null;
  const o = p.scene.clone(true); const def = p.def;
  o.rotation.y = (def.yaw || 0);
  const wrap = new THREE.Group(); wrap.add(o);
  wrap.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3());
  let k = 1;
  if (height) k = height / s.y; else if (size) k = Math.min(size[0] / s.x, size[1] / s.y, size[2] / s.z);
  o.scale.multiplyScalar(k); wrap.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(o); const c = b2.getCenter(new THREE.Vector3());
  o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b2.min.y;
  wrap.rotation.y = yaw;
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material) { m.material.envMapIntensity = def.env ?? 0.6; if (def.rough !== undefined) m.material.roughness = def.rough; } } });
  return wrap;
}

export class Character {
  constructor(id, { height } = {}) {
    const L = loaded.chars[id]; this.ok = !!L; if (!L) return;
    const def = L.def; this.def = def;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(L.base.scene);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model, true);
    const h = height || def.height || 1.7; const s = h / (box.max.y - box.min.y);
    this.model.scale.multiplyScalar(s); this.model.position.y = -box.min.y * s;
    this.model.rotation.y = def.yaw || 0;
    this.root.add(this.model);
    this.bones = {}; this.meshes = [];
    this.model.traverse(o => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; this.meshes.push(o); if (o.material) { o.material.envMapIntensity = 0.5; if (def.tint) o.material.color?.multiply(new THREE.Color(def.tint)); } }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const [n, c] of Object.entries(L.clips)) this.actions[n] = this.mixer.clipAction(c);
    this.current = null; this.currentName = '';
    this.play('idle', { fade: 0 });
  }
  has(n) { return !!this.actions[n]; }
  play(name, { fade = 0.25, once = false, speed = 1, restart = false } = {}) {
    if (!this.ok) return;
    let a = this.actions[name]; if (!a) { a = this.actions.idle; name = 'idle'; } if (!a) return;
    a.timeScale = speed;
    if (this.current === a && !restart) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.enabled = true; a.setEffectiveWeight(1);
    if (this.current && fade > 0) { a.play(); this.current.crossFadeTo(a, fade, false); } else { if (this.current) this.current.stop(); a.play(); }
    this.current = a; this.currentName = name;
  }
  speed(v) { if (this.current) this.current.timeScale = v; }
  progress() { if (!this.current) return 1; return this.current.time / this.current.getClip().duration; }
  update(dt) { if (this.ok) this.mixer.update(dt); }
  // listen-mode x-ray: skinned duplicates sharing geometry and skeleton
  addSilhouette(mat) {
    for (const m of this.meshes) {
      if (!m.isSkinnedMesh) continue;
      const c = new THREE.SkinnedMesh(m.geometry, mat); c.bind(m.skeleton, m.bindMatrix);
      c.position.copy(m.position); c.quaternion.copy(m.quaternion); c.scale.copy(m.scale); c.renderOrder = 999; c.frustumCulled = false; m.parent.add(c);
    }
  }
  attach(boneName, obj) { const b = this.bones[boneName]; if (b) { b.add(obj); return true; } return false; }
}
