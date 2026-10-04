// Procedural humanoids (survivor + infected) and their animation.
import * as THREE from 'three';

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
function cap(r, len, mat) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function limb(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

export function makeHumanoid(c) {
  const s = c.scale || 1; const root = new THREE.Group(); const body = new THREE.Group(); body.scale.setScalar(s); root.add(body);
  const hips = limb(body, 0, 0.95, 0);
  const torso = limb(hips, 0, 0.02, 0);
  const tm = cap(0.16, 0.36, c.top); tm.position.y = 0.3; tm.scale.set(1.2, 1, 0.78); torso.add(tm);
  const pelvis = cap(0.14, 0.08, c.pants); pelvis.position.y = 0.02; pelvis.scale.set(1.15, 1, 0.8); hips.add(pelvis);
  const neck = limb(torso, 0, 0.6, 0);
  const head = limb(neck, 0, 0.1, 0);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), c.skin); hm.scale.set(0.92, 1.12, 1); hm.castShadow = true; head.add(hm);
  const nk = cap(0.045, 0.08, c.skin); nk.position.y = -0.02; neck.add(nk);
  const arms = [], elbows = [], legs = [], knees = [], hands = [];
  for (const sx of [-1, 1]) {
    const sh = limb(torso, sx * 0.21, 0.52, 0);
    const ua = cap(0.052, 0.22, c.top); ua.position.y = -0.14; sh.add(ua);
    const el = limb(sh, 0, -0.29, 0);
    const fa = cap(0.043, 0.2, c.sleeve || c.top); fa.position.y = -0.13; el.add(fa);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), c.skin); hand.position.y = -0.28; el.add(hand);
    arms.push(sh); elbows.push(el); hands.push(hand);
    const lg = limb(hips, sx * 0.1, -0.04, 0);
    const th = cap(0.075, 0.32, c.pants); th.position.y = -0.2; lg.add(th);
    const kn = limb(lg, 0, -0.42, 0);
    const sn = cap(0.06, 0.32, c.pants); sn.position.y = -0.2; kn.add(sn);
    const ft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), c.shoe); ft.position.set(0, -0.44, 0.05); ft.castShadow = true; kn.add(ft);
    legs.push(lg); knees.push(kn);
  }
  return { root, body, hips, torso, neck, head, armL: arms[0], armR: arms[1], elbowL: elbows[0], elbowR: elbows[1], legL: legs[0], legR: legs[1], kneeL: knees[0], kneeR: knees[1], handL: hands[0], handR: hands[1], phase: 0, extras: {} };
}

export function makeSurvivor() {
  const h = makeHumanoid({ skin: std(0xc99a80, 0.6), top: std(0x3d4436, 0.95), sleeve: std(0x3d4436, 0.95), pants: std(0x2c3440, 0.9), shoe: std(0x2a221c, 0.9), scale: 0.97 });
  const hair = std(0x5a2e1c, 0.8);
  const hc = new THREE.Mesh(new THREE.SphereGeometry(0.112, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hair); hc.position.y = 0.02; hc.rotation.x = -0.25; h.head.add(hc);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), hair); bun.position.set(0, 0.05, -0.1); h.head.add(bun);
  const tail = limb(h.head, 0, 0.02, -0.12); const tm = cap(0.025, 0.12, hair); tm.position.y = -0.08; tail.add(tm); h.extras.tail = tail;
  // backpack
  const pack = limb(h.torso, 0, 0.3, -0.17); h.extras.pack = pack;
  const pm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.16), std(0x4a3a2a, 0.95)); pm.castShadow = true; pack.add(pm);
  const roll = cap(0.06, 0.2, std(0x5a5a3a, 1)); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.22, 0); pack.add(roll);
  for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.3), std(0x2a2018)); st.position.set(sx * 0.12, 0.02, 0.1); h.torso.children[0].add; pack.add(st); }
  // pistol in right hand
  const gun = new THREE.Group(); gun.position.set(0, -0.3, 0.04); h.elbowR.add(gun);
  const gm = std(0x1a1a1c, 0.4, { metalness: 0.7 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.19), gm); slide.position.set(0, 0.02, 0.07); gun.add(slide);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.1, 0.045), gm); grip.rotation.x = 0.25; grip.position.set(0, -0.03, 0); gun.add(grip);
  gun.rotation.x = Math.PI / 2; gun.visible = false; h.extras.gun = gun;
  // knife (sheath on hip, drawn during melee)
  const knife = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.18), std(0xb8b8b8, 0.2, { metalness: 1 })); knife.position.set(0, -0.3, 0.1); knife.visible = false; h.elbowR.add(knife); h.extras.knife = knife;
  // shoulder flashlight
  const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.1, 8), std(0x222222, 0.4)); fl.rotation.x = Math.PI / 2; fl.position.set(-0.12, 0.5, 0.13); h.torso.add(fl);
  // fungal strand for the final moment
  const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.12, 4), std(0xe8dcc0, 0.5)); strand.position.set(0.03, -0.24, 0); strand.rotation.z = 0.8; strand.visible = false; h.elbowL.add(strand); h.extras.strand = strand;
  return h;
}

const FUNGUS = [0xd9a86a, 0xc48a4c, 0xe8d0a8, 0x9a6a3a];
function growth(parent, n, spread, size, rnd = Math.random) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, i % 2 ? Math.PI / 2 : Math.PI), std(FUNGUS[i % 4], 0.6));
    const s = size * (0.5 + rnd()); g.scale.set(s, s * (0.3 + rnd() * 0.5), s); g.position.set((rnd() - 0.5) * spread, (rnd() - 0.2) * spread, (rnd() - 0.2) * spread);
    g.rotation.set(rnd() * 2 - 1, rnd() * 6, rnd() * 2 - 1); g.castShadow = true; parent.add(g);
  }
}

export function makeInfected(type) {
  const skin = std(type === 'lurker' ? 0x6a6050 : 0x8a7e6e, 0.85), top = std([0x4a4a52, 0x5a4a3a, 0x3a4a4a][Math.floor(Math.random() * 3)], 1);
  const big = type === 'bigknocker';
  const h = makeHumanoid({ skin, top, pants: std(0x2e2e30, 1), shoe: std(0x1e1a18), scale: big ? 1.3 : 1 });
  h.type = type;
  if (type === 'knocker' || big) {
    h.head.children[0].visible = false; // face split open by fruiting plates
    const plates = limb(h.head, 0, 0.02, 0.02); h.extras.plates = plates;
    for (let i = 0; i < (big ? 22 : 12); i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(FUNGUS[i % 4], 0.55));
      const a = (i / 12) * Math.PI * 2; const s = 0.07 + Math.random() * 0.06; p.scale.set(s, s * 0.35, s * 0.8);
      p.position.set(Math.cos(a) * 0.08, 0.02 + (Math.random() - 0.3) * 0.12, Math.sin(a) * 0.06 + 0.03); p.rotation.set(Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2 + (Math.random() - 0.5)); p.castShadow = true; plates.add(p);
    }
    growth(h.torso, big ? 16 : 6, 0.3, big ? 0.1 : 0.06);
    if (big) growth(h.armR, 8, 0.2, 0.08);
  } else if (type === 'lurker') {
    growth(h.head, 7, 0.12, 0.05); growth(h.torso, 10, 0.35, 0.07); growth(h.armL, 4, 0.15, 0.05);
  } else {
    growth(h.head, 3, 0.1, 0.035); growth(h.torso, 3, 0.25, 0.04);
  }
  // listen-mode silhouette: duplicate every mesh with an x-ray material in the same parent
  const sil = new THREE.MeshBasicMaterial({ color: 0xf0eee8, transparent: true, opacity: 0.0, depthTest: false, depthWrite: false });
  const meshes = []; h.root.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) { const c = new THREE.Mesh(m.geometry, sil); c.position.copy(m.position); c.rotation.copy(m.rotation); c.scale.copy(m.scale); c.renderOrder = 999; c.visible = m.visible; m.parent.add(c); }
  h.silMat = sil;
  return h;
}

// Procedural animation. o: {speed (m/s), crouch 0..1, aim 0..1, dt, run 0..1, hunch 0..1, twitch}
export function animate(h, o) {
  const dt = o.dt;
  const stride = o.speed > 0.05 ? o.speed / (0.9 + o.speed * 0.25) : 0;
  h.phase += dt * (stride * 4.2 + 0.0001);
  const ph = h.phase, amp = Math.min(1, o.speed / 2.5) * (1 - o.crouch * 0.3);
  const cr = o.crouch, hunch = o.hunch || 0;
  const k = Math.min(1, dt * 14);
  const L = (obj, prop, val) => { obj.rotation[prop] += (val - obj.rotation[prop]) * k; };
  const swing = Math.sin(ph) * 0.65 * amp;
  L(h.legL, 'x', -swing - cr * 0.9 - hunch * 0.3); L(h.legR, 'x', swing - cr * 0.9 - hunch * 0.3);
  L(h.kneeL, 'x', Math.max(0, Math.cos(ph)) * 1.0 * amp + cr * 1.5 + hunch * 0.5);
  L(h.kneeR, 'x', Math.max(0, -Math.cos(ph)) * 1.0 * amp + cr * 1.5 + hunch * 0.5);
  const bob = Math.abs(Math.sin(ph)) * 0.04 * amp;
  const targetY = 0.95 - cr * 0.33 - hunch * 0.12 + bob;
  h.hips.position.y += (targetY - h.hips.position.y) * k;
  L(h.torso, 'x', cr * 0.35 + (o.run || 0) * 0.3 + hunch * 0.6 + (o.lean || 0));
  L(h.torso, 'y', Math.sin(ph) * 0.12 * amp);
  L(h.torso, 'z', o.tilt || 0);
  if (o.aim > 0.5) {
    L(h.armR, 'x', -1.45 + (o.recoil || 0) * 0.8 + (o.aimPitch || 0)); L(h.armR, 'z', 0.15); L(h.elbowR, 'x', -0.1);
    L(h.armL, 'x', -1.35 + (o.aimPitch || 0)); L(h.armL, 'z', -0.55); L(h.elbowL, 'x', -0.35);
  } else if (o.shield) {
    L(h.armL, 'x', -2.2); L(h.armL, 'z', -0.3); L(h.elbowL, 'x', -1.9); L(h.armR, 'x', swing * 0.8); L(h.armR, 'z', 0.1); L(h.elbowR, 'x', -0.4);
  } else if (o.pose === 'strike') {
    L(h.armR, 'x', -1.6); L(h.armR, 'z', 0.3); L(h.elbowR, 'x', -0.2); L(h.armL, 'x', -0.9); L(h.elbowL, 'x', -1.2);
  } else if (o.pose === 'struggle') {
    L(h.armR, 'x', -1.3); L(h.armR, 'z', 0.4); L(h.elbowR, 'x', -1.4); L(h.armL, 'x', -1.3); L(h.armL, 'z', -0.4); L(h.elbowL, 'x', -1.4);
  } else if (o.pose === 'reach') { // infected lunging
    L(h.armR, 'x', -1.4 + Math.sin(ph * 2) * 0.2); L(h.armL, 'x', -1.2 - Math.sin(ph * 2) * 0.2); L(h.armR, 'z', 0.3); L(h.armL, 'z', -0.3); L(h.elbowR, 'x', -0.3); L(h.elbowL, 'x', -0.3);
  } else if (o.pose === 'pull') { // final: pulling strand off the cuff
    L(h.armL, 'x', -1.1); L(h.armL, 'z', -0.1); L(h.elbowL, 'x', -1.3); L(h.armR, 'x', -1.2); L(h.armR, 'z', -0.3); L(h.elbowR, 'x', -1.1);
  } else if (o.pose === 'heal') {
    L(h.armL, 'x', -0.9); L(h.elbowL, 'x', -1.6); L(h.armR, 'x', -1.0); L(h.elbowR, 'x', -1.4); L(h.armR, 'z', -0.2);
  } else {
    L(h.armL, 'x', swing * 0.8 - cr * 0.3 - hunch * 0.6); L(h.armR, 'x', -swing * 0.8 - cr * 0.3 - hunch * 0.6);
    L(h.armL, 'z', -0.08 - hunch * 0.3); L(h.armR, 'z', 0.08 + hunch * 0.3);
    L(h.elbowL, 'x', -0.25 - amp * 0.5 - cr * 0.4); L(h.elbowR, 'x', -0.25 - amp * 0.5 - cr * 0.4);
  }
  // head: look + twitch
  L(h.head, 'y', o.headYaw || 0); L(h.head, 'x', (o.headPitch || 0) - (o.aim > 0.5 ? 0 : cr * 0.25) - hunch * 0.3);
  L(h.head, 'z', o.headRoll || 0);
  if (h.extras.tail) { h.extras.tail.rotation.x = 0.3 + Math.sin(ph * 2) * 0.25 * amp + (o.run || 0) * 0.5; h.extras.tail.rotation.z = Math.sin(ph) * 0.3 * amp; }
  if (h.extras.pack) { h.extras.pack.position.y = 0.3 + Math.sin(ph * 2) * 0.012 * amp; h.extras.pack.rotation.x = -Math.abs(Math.sin(ph)) * 0.08 * amp; }
}
