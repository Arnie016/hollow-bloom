// Hollow Bloom — game loop, player, camera, rendering, combat, crafting, puzzles, flow, checkpoints.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as L from './level.js';
import { AudioSys } from './audio.js';
import { makeSurvivor, animate } from './models.js';
import { Enemy } from './ai.js';
import { FX } from './fx.js';
import { Scorch } from './scorch.js';
import { preload, loaded, Character, prop, load } from './assets.js';
import { MELEE, buildMelee } from './weapons.js';
import { createUI } from './ui.js';
import * as S from './save.js';
import { ITEMS, buildItem, renderIcons } from './items.js';
import { createMap } from './map.js';
import { PracticeGuide } from './tutorial.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// ------------------------------------------------------------------ assets first (title shows progress)
await preload(p => { $('loadbar').style.width = Math.round(p * 100) + '%'; });
// Original compact Blender prop; the existing model remains a load-failure fallback.
const originalPistol = await load('assets/models/survival-pistol-original.glb');
if (originalPistol) loaded.props.survival_pistol_original = { scene: originalPistol.scene, def: { env: 0.45 } };
const icons = renderIcons(Object.keys(ITEMS)); // studio renders of every item for the backpack
$('loading').textContent = 'PRESS ENTER OR CLICK · HEADPHONES RECOMMENDED'; $('loading').classList.add('go');

// ------------------------------------------------------------------ renderer / scene / post
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x4a545c, 0.045); scene.background = new THREE.Color(0x4a545c);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 140);
const hemi = new THREE.HemisphereLight(0x8a9ab0, 0x2c2a26, 1.3); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9aaabb, 0.5); moon.position.set(-20, 30, 10); scene.add(moon);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1.2, scale: 1.1 }); gtao.blendIntensity = 0.85;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.55, 0.85); composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.38 }, sat: { value: 0.82 }, tint: { value: new THREE.Color(1, 1, 1) }, hurt: { value: 0 }, grain: { value: 0.025 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vig, sat, hurt, grain; uniform vec3 tint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, sat) * tint;
      c += vec3(-0.004, 0.0, 0.006) * (1.0 - smoothstep(0.0, 0.3, l)); // cool the deep shadows slightly
      vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * vig * 2.2;
      c *= clamp(v, 0.0, 1.0);
      c = mix(c, c * vec3(1.25, 0.35, 0.3), hurt * smoothstep(0.15, 0.7, length(d)));
      c += (h(vUv * 1000.0) - 0.5) * grain * (0.3 + l);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());
function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); gtao.setSize(innerWidth, innerHeight); }
addEventListener('resize', onResize);

const world = L.buildWorld(scene);
const fx = new FX(scene);
const scorch = new Scorch(world.burnableGrowth || [], fx);
const audio = new AudioSys();

const flash = new THREE.SpotLight(0xfff0d8, 0, 28, 0.46, 0.5, 1.1);
flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.camera.near = 0.3; flash.shadow.bias = -0.0006; flash.shadow.normalBias = 0.02;
scene.add(flash, flash.target);
const fill = new THREE.PointLight(0xfff0d8, 0, 5, 2); scene.add(fill);
const muzzle = new THREE.PointLight(0xffc070, 0, 12, 2); scene.add(muzzle);
const charLight = new THREE.PointLight(0xcfd8e0, 0.9, 4, 2); scene.add(charLight);
// escape route: a red emergency beacon at the torn wall, and floor strips that chase west along the nest's lower lane
const beacon = new THREE.PointLight(0xff2a1a, 0, 18, 1.2); { const c = L.center(37, 24); beacon.position.set(c.x + 1.3, 2.7, c.z); } scene.add(beacon);
const beaconLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x300808 })); beaconLamp.position.copy(beacon.position); scene.add(beaconLamp);
const trail = [];
for (const x of [57, 54, 51, 48, 45, 42, 39]) { const c = L.center(x, 25); const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.06), new THREE.MeshBasicMaterial({ color: 0x1a0404 })); m.position.set(c.x, 0.05, c.z + 0.88); scene.add(m); trail.push(m); }

// per-area environment reflection strength (keeps PBR assets from glowing in dark rooms)
const envMats = new Set();
function registerEnv(root) { root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && 'envMapIntensity' in m && !envMats.has(m)) { m.userData.envBase ??= m.envMapIntensity ?? 1; envMats.add(m); } }); }
registerEnv(scene);
const AREA_ENV = { street: 0.9, outside: 0.9, pharmacy: 0.4, corridor: 0.12, apartment: 0.2, nest: 0.14, escape: 0.12 };
let envK = 1;

// ------------------------------------------------------------------ settings (persisted; see save.js)
const settings = S.loadSettings();
settings.difficulty ??= 'medium';
const incomingDamage = () => ({ easy: 0.5, medium: 1, hard: 1.5 }[settings.difficulty] ?? 1);
const QUALITY = { low: { pr: 0.75, ao: false, bloom: false, shadow: 512 }, medium: { pr: 1, ao: false, bloom: true, shadow: 1024 }, high: { pr: 1.5, ao: true, bloom: true, shadow: 1024 }, ultra: { pr: 2, ao: true, bloom: true, shadow: 2048 } };
const SHAKE = { full: 1, reduced: 0.4, off: 0 };
let ui = null, appliedQ = null;
function applyQuality(q) {
  const k = QUALITY[q] || QUALITY.high;
  pixelRatio = Math.min(devicePixelRatio, k.pr); renderer.setPixelRatio(pixelRatio); gtao.enabled = k.ao; bloom.enabled = k.bloom;
  if (flash.shadow.mapSize.x !== k.shadow) { flash.shadow.mapSize.set(k.shadow, k.shadow); flash.shadow.map?.dispose(); flash.shadow.map = null; }
  onResize();
}
function applySettings(s) {
  if (audio.ok) { audio.master.gain.value = s.master / 10 * (paused ? 0.35 : 1); audio.sfxBus.gain.value = s.effects / 8; audio.ambBus.gain.value = s.effects / 8; audio.musBus.gain.value = 0.55 * s.music / 7; }
  audio.voiceVol = s.voiceVol / 10;
  if (s.quality !== appliedQ) { appliedQ = s.quality; applyQuality(s.quality === 'auto' ? 'high' : s.quality); }
  if (!s.subtitles) $('sub').style.opacity = 0;
  ui?.setFPS(s.fps, W.fps);
}

// ------------------------------------------------------------------ player
const hero = makeSurvivor(); scene.add(hero.root);
const heroC = loaded.chars.wren?.clips?.walk ? new Character('wren') : null;
let gunMesh = hero.extras.gun, strandMesh = hero.extras.strand;
if (heroC?.ok) {
  hero.root.visible = false; scene.add(heroC.root); registerEnv(heroC.root);
  heroC.root.updateMatrixWorld(true);
  const hand = heroC.bones.RightHand, ws = new THREE.Vector3();
  const g = prop('survival-pistol-original', { size: [0.05, 0.17, 0.24] }) || prop('pistol', { size: [0.05, 0.17, 0.24] }) || new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.2), new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.7, roughness: 0.4 }));
  const gw = new THREE.Group(); gw.add(g); g.position.y = -0.045; g.rotation.x = 0; // barrel along the aim line // grip centred in the palm
  if (hand) { hand.getWorldScale(ws); gw.scale.setScalar(1 / ws.x); hand.add(gw); }
  scene.add(gw); gw.scale.setScalar(1); gunMesh = gw; gw.visible = false;
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.14, 4), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 }));
  const lh = heroC.bones.LeftHand; if (lh) { const ws2 = new THREE.Vector3(); lh.getWorldScale(ws2); const sw = new THREE.Group(); sw.scale.setScalar(1 / ws2.x); sw.add(st); st.rotation.z = 1.2; st.position.set(0.02, -0.04, 0); lh.add(sw); strandMesh = st; }
  st.visible = false;
}
// melee weapon held in the right hand (same frame as the pistol: blade along the aim line)
const meleeHolder = new THREE.Group(); const meleeModels = {};
{ const hand = heroC?.ok && heroC.bones.RightHand; if (hand) { const ws = new THREE.Vector3(); hand.getWorldScale(ws); meleeHolder.scale.setScalar(1 / ws.x); hand.add(meleeHolder); } else hero.elbowR.add(meleeHolder); }
if (heroC?.ok) { scene.add(meleeHolder); meleeHolder.scale.setScalar(1); }
for (const id of Object.keys(MELEE)) { const m = buildMelee(id); m.rotation.x = -Math.PI / 2; m.position.y = -0.02; m.visible = false; meleeHolder.add(m); meleeModels[id] = m; }
const heldItems = {};
for (const id of ['knife','bottle','brick','molotov','kit']) {
  const m = buildItem(id); m.rotation.x = -Math.PI / 2; m.position.y = -0.04;
  m.visible = false; meleeHolder.add(m); heldItems[id] = m;
}
const carryMesh = new THREE.Group(); scene.add(carryMesh); // plank while carried
const P = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: Math.PI / 2, crouch: false, crouchK: 0, moving: false, speed: 0,
  hp: 100, dead: false, ammo: 4, spare: 2, items: { bottle: 1, brick: 0, kit: 1, cloth: 0, alcohol: 0, blade: 0, binding: 0, molotov: 0, shiv: 0, scrap: 0 }, weapon: 'pistol', melee: null, swingT: 0, swingDur: 0.5, riposte: null,
  stamina: 1, dodgeT: 0, dodgeCool: 0, dodgeDir: new THREE.Vector3(), lockT: 0, aim: false, aimK: 0, reloadT: 0, healT: 0, craftT: 0, craftWhat: null,
  strikeT: 0, recoil: 0, fireCool: 0, iframe: 0, stepDist: 0, listen: false, struggle: null, flinch: 0, breathT: 0, lastFire: -9, pickT: 0, carry: null, anim: null, packOpen: false, throwPref: 'bottle', magSize: 6, upgrades: [],
};
let shotPose = 0;
let camYaw = Math.PI / 2, camPitch = -0.08, shoulder = 1, fovK = 0, shakeT = 0, shakeAmp = 0, camDist = 2.2, stepPhase = 0;
const camPivot = new THREE.Vector3(), camFwd = new THREE.Vector3(), flashDir = new THREE.Vector3(1, 0, 0);
const W = { scene, camera, player: P, audio, fx, enemies: [], flags: {}, camFwd, playerFacing: new THREE.Vector3(1, 0, 0), time: 0, flashlightOn: false, registerEnv };
const enemies = W.enemies;
const flags = W.flags;
let tutorial = null;
let mode = 'title', saved = null, gen = 0, taken = new Set(), projectiles = [], fires = [], curArea = null, objT = 0, invT = 0, thunderT = 12, ambT = 8, endT = 0, genT = 0;
const later = (sec, fn) => { const g = gen; setTimeout(() => { if (g === gen) fn(); }, sec * 1000); };
let paused = false, slot = null, playT = 0, uiClosedAt = 0, titleReady = false, trailerThen = false, notesFound = new Set();
const stats = { kills: 0, deaths: 0 };
const mapApi = createMap();

// ------------------------------------------------------------------ story notes (picked up like items, read in the journal)
const NOTES = [
  { id: 'n1', x: 10, z: 8, title: 'Notice from the door', where: 'Elm Street', text: 'CLOSED UNTIL FURTHER NOTICE.\n\nClinic stock moved to the back. Ask for Dale.\n\nDo NOT use the service corridor —\nthe floor is going.\n\n— Management' },
  { id: 'n2', x: 16, z: 8, title: "Dale's ledger", where: 'Pharmacy counter', text: 'Day 31. Rationing by the pill now. A girl came in asking for amoxicillin for her little brother. Gave her half a course. Should have given her all of it.\n\nDay 34. Sounds in the walls. Like knuckles on wood.\n\nDay 35. Moved the good stock through the corridor. Nobody follows you through there.' },
  { id: 'n3', x: 34, z: 9, title: 'Scratched into the wall', where: 'Service corridor', text: "THEY CAN'T SEE\nTHEY HEAR\n\nDON'T RUN\n\n                — R." },
  { id: 'n4', x: 41, z: 3, title: "A child's drawing", where: 'Apartment 2B', text: 'A house. Four stick people. Orange flowers growing out of the roof.\n\nMOM SAYS THE FLOWERS ARE SLEEPING\nSO WE HAVE TO BE QUIET LIKE MICE\n\nOne of the stick people has been scribbled out.' },
  { id: 'n5', x: 57, z: 24, title: 'Maintenance tag', where: 'Generator', text: 'GEN 2 — feeds the storeroom shutter.\n\nLoud as hell. If you start it, be ready to move.\nThey come to the noise. They ALWAYS come to the noise.\n\n— D.' },
  { id: 'n6', x: 61, z: 22, title: "Dale's last page", where: 'Storeroom', text: "It's in the walls now. When the generator runs you can feel it breathe.\n\nThe antibiotics are in the clinic box. Sutures too. Take them.\n\nSomebody should get to go home." },
  // New Story+: a friend walked this way before you
  { id: 'j1', x: 5, z: 9, cycle: 1, title: 'Chalk spiral on the curb', where: 'Elm Street', text: "Wren —\n\nIf you're reading this, you came back. So did I. I keep coming back.\n\nFollow the spirals.\n\n— Juno" },
  { id: 'j2', x: 30, z: 10, cycle: 1, title: 'Spiral by the grate', where: 'Service corridor', text: "Don't trust the floor.\nDon't trust the quiet.\n\nThe one in the back room — it waits until you stop listening.\n\n— J" },
  { id: 'j3', x: 46, z: 24, cycle: 1, title: 'Spiral on a pipe', where: 'The Nest', text: "The big one counts footsteps.\nFour clicks, then it moves.\n\nBottles. Always carry bottles.\n\n— J" },
  { id: 'j4', x: 62, z: 24, cycle: 1, title: 'Spiral on the shutter', where: 'Storeroom', text: "You made it. Told you you would.\n\nGo home to your brother.\nI'll hold the door this time.\n\n— Juno" },
];
for (const n of NOTES) L.PICKUPS.push({ id: n.id, kind: 'note', x: n.x, z: n.z, cycle: n.cycle || 0 });
const noteVisible = (p) => p.kind !== 'note' || !p.cycle || (W.cycle || 0) >= p.cycle;

// ------------------------------------------------------------------ pickups (GLB where available)
const pickMeshes = new Map();
const pm = (c, r = 0.6, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...e });
for (const p of L.PICKUPS) {
  const g = new THREE.Group(); const c = L.center(p.x, p.z); g.position.set(c.x + 0.3, 0, c.z - 0.2); scene.add(g);
  let m;
  if (p.kind === 'bottle') { m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10), pm(0x2f5a38, 0.1, { transparent: true, opacity: 0.8, metalness: 0.3 })); m.position.y = 0.05; m.rotation.z = 1.4; }
  else if (p.kind === 'brick') { m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.11), pm(0x7a3a28, 1)); m.position.y = 0.035; }
  else if (p.kind === 'ammo') { m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), pm(0xa08a40, 0.5, { metalness: 0.4 })); m.position.y = 0.03; }
  else if (p.kind === 'cloth') { m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), pm(0xc8c0b0, 1)); m.position.y = 0.015; }
  else if (p.kind === 'alcohol') { m = prop('craft', { height: 0.3 }) || new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.2, 10), pm(0x6a3a18, 0.15)); }
  else if (MELEE[p.kind]) { m = buildMelee(p.kind); m.rotation.y = (p.x * 7 + p.z) % 6; m.position.y = 0.03; }
  else if (p.kind === 'note') { m = buildItem('notes'); m.rotation.y = (p.x * 3 + p.z) % 6; m.position.y = 0.01; m.scale.setScalar(1.6); }
  else if (p.kind === 'scrap') { m = buildItem('scrap'); m.scale.setScalar(1.4); }
  else if (p.kind === 'blade') { m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.04), pm(0xb0b0b0, 0.25, { metalness: 1 })); m.position.y = 0.01; m.rotation.y = 0.6; }
  else if (p.kind === 'binding') { m = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 14), pm(0x3a3a3a, 0.8)); m.rotation.x = Math.PI / 2; m.position.y = 0.02; }
  else { m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), pm(0xe8e4d8, 0.6)); m.position.y = 0.95; const cr = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xc02020 })); cr.position.set(0, 0, 0.151); m.add(cr); const st = prop('crate', { size: [0.9, 0.8, 0.7] }) || new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), pm(0x4a3a2a, 0.9)); if (st.isMesh) st.position.y = 0.4; g.add(st); }
  m.traverse?.(o => { if (o.isMesh) o.castShadow = true; }); g.add(m); pickMeshes.set(p.id, g); g.visible = noteVisible(p);
}
registerEnv(scene);
const NAME = { repair: 'Repair melee (+3)', note: 'Read note', scrap: 'Scrap', brushblade: MELEE.brushblade.name, nailboard: MELEE.nailboard.name, machete: MELEE.machete.name, saber: MELEE.saber.name, bottle: 'Bottle', brick: 'Brick', ammo: 'Pistol ammo', cloth: 'Cloth', alcohol: 'Alcohol', med: 'Medical supplies', blade: 'Blade', binding: 'Binding', kit: 'Health kit', molotov: 'Molotov', shiv: 'Shiv' };
const RECIPES = [
  { id: 'kit', need: { cloth: 1, alcohol: 1 }, t: 2.2, max: 3 },
  { id: 'molotov', need: { cloth: 1, alcohol: 1 }, t: 1.8, max: 3 },
  { id: 'shiv', need: { blade: 1, binding: 1 }, t: 1.4, max: 3 },
  { id: 'repair', need: { binding: 1 }, t: 1.6, max: 99 },
];

// ------------------------------------------------------------------ UI
function objective(text, hint = '') { if (text) $('objective').querySelector('span').textContent = text; $('objective').querySelector('em').textContent = hint; $('objective').style.opacity = 1; objT = 7; }
function toast(text) { if (!text) return; $('toast').textContent = text; $('toast').style.opacity = 0.85; clearTimeout(toast.t); toast.t = setTimeout(() => $('toast').style.opacity = 0, 2200); }
function subtitle(text, sec = 3) { if (!settings.subtitles) return; $('sub').textContent = text; $('sub').style.opacity = 0.9; clearTimeout(subtitle.t); subtitle.t = setTimeout(() => $('sub').style.opacity = 0, sec * 1000); }
function fade(to, sec = 0.8) { const f = $('fade'); f.style.transition = `opacity ${sec}s`; f.style.opacity = to; }
function showInv() { invT = 3; }
function canCraft(r) { if (r.id === 'repair') return P.items.binding >= 1 && !!P.melee && P.melee.dur < MELEE[P.melee.id].dur; return Object.entries(r.need).every(([k, n]) => P.items[k] >= n) && P.items[r.id] < r.max; }
let hudT = 0;
function updateHUD(dt) {
  const hp = $('hp').firstElementChild; hp.style.width = P.hp + '%'; hp.style.background = P.hp < 35 ? '#c04030' : '#d8d2c0';
  const w = P.weapon;
  const md = P.weapon === 'melee' && P.melee ? `<em>${MELEE[P.melee.id].name.toUpperCase()} ${'▮'.repeat(Math.max(0, P.melee.dur))}${'▯'.repeat(Math.max(0, MELEE[P.melee.id].dur - P.melee.dur))}</em>` : '';
  const heldName = w === 'none' ? 'EMPTY HANDS' : w === 'melee' ? (P.melee ? MELEE[P.melee.id].name.toUpperCase() : 'POCKET KNIFE') : w === 'throw' ? throwKind().toUpperCase() : w.toUpperCase();
  const count = w === 'pistol' ? `${P.ammo} loaded · ${P.spare} spare` : w === 'molotov' ? `${P.items.molotov} carried` : w === 'throw' ? `${P.items[throwKind()] || 0} carried` : w === 'melee' ? P.melee ? `${P.melee.dur} condition` : 'Reusable' : 'Select from Tab';
  $('weapon').innerHTML = `<i>IN HAND · ${heldName}</i><b style="font-size:18px">${count}</b><em>${w === 'none' ? 'Empty hands' : '1 item held'} · ${P.items.kit} health kit${P.items.kit===1?'':'s'}</em>` + (w === 'pistol' ? '<em>CLICK / ENTER shoot · RIGHT CLICK / Z aim · R reload</em>' : w === 'none' ? '<em>TAB select an item</em>' : w === 'melee' ? '<em>CLICK / F strike · TAB change item</em>' : '<em>CLICK / G throw · TAB change item</em>');
  $('weapon').style.opacity = ui.open ? 0.35 : 0.9;
  $('cross').style.opacity = w === 'pistol' && !ui.open ? (P.aimK > 0.7 ? 0.8 : 0.35) : 0;
  objT -= dt; if (objT < 0 && mode === 'play') $('objective').style.opacity = 0.55;
  invT -= dt;
  grade.uniforms.hurt.value = damp(grade.uniforms.hurt.value, P.dead ? 0 : clamp((45 - P.hp) / 45, 0, 0.8), 3, dt);
  $('struggle').style.opacity = P.struggle ? 1 : 0; if (P.struggle) $('struggle').querySelector('.bar div').style.width = (P.struggle.n / P.struggle.need * 100) + '%';
  hudT -= dt; if (hudT > 0) return; hudT = 0.12;
  if (P.packOpen) ui.refreshPack();
}
const throwKind = () => P.throwPref === 'brick' && P.items.brick > 0 ? 'brick' : P.items.bottle > 0 ? 'bottle' : P.items.brick > 0 ? 'brick' : P.throwPref || 'bottle';

// ------------------------------------------------------------------ objectives, guidance & progress
// Stages are derived from world state, so a loaded save always knows where the player is in the story.
const STAGES = [
  { id: 'street', when: () => !flags.pharmacy, obj: ['Search the pharmacy', 'Green cross across the street'], target: () => [11, 7], nudge: 'The pharmacy… green cross, across the street.' },
  { id: 'pharmacy', when: () => !flags.pitHint && !L.obstacles.plankPlaced && P.carry !== 'plank', obj: ['Find the clinic stock', 'Through the back of the pharmacy, past the shelves'], target: () => flags.corridor ? [31, 8] : [25, 10], nudge: "Stock's not out front. There's a door in the back." },
  { id: 'plank', when: () => !L.obstacles.plankPlaced && P.carry !== 'plank', obj: ['Bridge the collapsed floor', 'Fetch the plank from the pharmacy storeroom'], target: () => L.cellOf(world.plank.position.x, world.plank.position.z), nudge: "That plank in the storeroom… it'd reach." },
  { id: 'bridge', when: () => !L.obstacles.plankPlaced, obj: ['Bridge the collapsed floor', 'Carry it to the hole in the service corridor · E to lay it'], target: () => [31, 8], nudge: 'Get it across the gap.' },
  { id: 'corridor', when: () => !flags.aptEntered, obj: ['Follow the service corridor', 'Cross the plank and squeeze through at the end'], target: () => [38, 10], nudge: "There's a gap at the end. I can squeeze through." },
  { id: 'apartment', when: () => !flags.dropped, obj: ['Find a way down', 'Look for an orange glow through the floor — far corner room'], target: () => [52, 13], nudge: "That glow… there's a hole in the floor. Far corner." },
  { id: 'nest', when: () => !flags.genOn, obj: ['Cross the nest', 'Stay crouched off the fungus · generator at the far end, lower lane'], target: () => [58, 25], nudge: 'Generator. Far end, bottom lane. Quiet.' },
  { id: 'shutter', when: () => !L.obstacles.shutterOpen, obj: ['Get the medical supplies', 'The shutter is rising — storeroom in the right wall'], target: () => [60, 23], nudge: 'Come on… open.' },
  { id: 'meds', when: () => !flags.escape, obj: ['Get the medical supplies', 'Inside the storeroom'], target: () => [61, 24], nudge: 'The clinic box. Grab it.' },
  { id: 'escape', when: () => !flags.pastTear, obj: ['GET OUT', 'Back west along the lower lane to the torn wall — follow the red light'], target: () => [37, 24], nudge: 'The wall by the red light — it tore open. Go!' },
  { id: 'exit', when: () => !flags.ending, obj: ['GET OUT', 'Follow the red lights west to the EXIT door'], target: () => [14, 23], nudge: 'Exit sign. Keep going west.' },
  { id: 'done', when: () => true, obj: ['', ''], target: null },
];
const stageNow = () => STAGES.find(st => st.when());
function progressPct() { if (flags.ending) return 100; return Math.round(STAGES.indexOf(stageNow()) / (STAGES.length - 1) * 100); }
function showStageObjective() { const st = stageNow(); if (st.obj[0]) objective(st.obj[0], st.obj[1]); }
function say(text, sec = 3.2) { subtitle(text, sec); } // voice lines hook in here
let stageId = null, stageT = 0, nudged = 0;
const gv = new THREE.Vector3();
function updateGuide(dt) {
  const st = stageNow(); if (st.id !== stageId) { stageId = st.id; stageT = 0; nudged = 0; }
  const combat = enemies.some(e => e.alive && (e.state === 'COMBAT' || e.state === 'ALERT'));
  if (!combat && !P.struggle) stageT += dt;
  const g = settings.guidance;
  if (g !== 'off' && !combat && st.nudge && ((nudged === 0 && stageT > 75) || (nudged === 1 && stageT > 170))) { nudged++; say(st.nudge, 3.5); }
  const show = st.target && !combat && !P.dead && !ui.open && (g === 'always' || (g === 'delayed' && stageT > 60));
  if (!show) { ui.guide(false); return; }
  const [tx, tz] = st.target(); const c = L.center(tx, tz); const dist = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
  if (dist < 3.5) { ui.guide(false); return; }
  gv.set(c.x, 1.3, c.z).project(camera); let x = gv.x, y = gv.y; const behind = gv.z > 1; if (behind) { x = -x; y = -y; }
  const m = Math.max(Math.abs(x) / 0.86, Math.abs(y) / 0.78, 1e-3); if (behind || m > 1) { x /= m; y /= m; }
  ui.guide(true, (x * 0.5 + 0.5) * innerWidth, (-y * 0.5 + 0.5) * innerHeight, `${Math.round(dist)} m`);
}

// ------------------------------------------------------------------ screens (backpack, menus, saves)
const AREA_NAME = { street: 'Elm Street', pharmacy: 'Pharmacy', corridor: 'Service corridor', apartment: 'Apartments', nest: 'The Nest', escape: 'Escape tunnel', outside: 'The yard' };
const CP_NAME = { start: 'Elm Street', pharmacy: 'Pharmacy', apartment: 'Apartments', nest: 'The Nest', escape: 'Storeroom' };
function foundNotes() { return NOTES.filter(n => notesFound.has(n.id)); }
function credits() { return 'A GAME BY ARNAV SALKADE<br>BUILT WITH THREE.JS · AI-ASSISTED DEVELOPMENT (CLAUDE, CODEX)' + (W.voiceOK ? '<br>VOICE OF WREN · ELEVENLABS' : '') + '<br>SOUND EFFECTS GENERATED WITH ELEVENLABS · KENNEY (CC0) · MIXKIT<br>ART, MODELS &amp; TRAILER MADE WITH HIGGSFIELD<br>THANK YOU FOR PLAYING'; }
ui = createUI({
  P, audio, ITEMS, MELEE, RECIPES, icons, settings, canCraft,
  flags: () => flags, notes: foundNotes,
  craftProgress: () => P.craftT > 0 && P.craftWhat ? { id: P.craftWhat, k: clamp(1 - P.craftT / (RECIPES.find(r => r.id === P.craftWhat)?.t || 1), 0, 1) } : null,
  objectiveText: () => $('objective').querySelector('span').textContent || '',
  startCraft, reload, dropMelee: () => { if (P.melee) dropMelee(); }, equip: equipItem,
  useKit: () => { if (P.items.kit > 0 && P.hp < 100 && P.healT <= 0) { heal(); return true; } toast(P.items.kit ? 'Already at full health' : 'No health kit'); return false; },
  openMap: () => openMap(), openPackFromMenu: () => openPack(),
  onTutorial: () => startPractice(),
  onPackClosed: () => { P.packOpen = false; uiClosedAt = performance.now(); relock(); },
  onMapClosed: () => { setPaused(false); uiClosedAt = performance.now(); relock(); },
  onPause: (on) => { setPaused(on); if (!on) { uiClosedAt = performance.now(); relock(); } },
  onRetry, onQuitToTitle: () => toTitle(), onContinue, onNewGame, onNewStoryPlus, onTrailer: () => playTrailer(false), showTitle: (v) => toTitle(v),
  checkpointInfo: () => ({ name: saved?.label || 'Start', at: saved?.at || Date.now(), area: AREA_NAME[curArea?.id] || '', progress: progressPct(), playtime: playT }),
  mapInfo: () => ({ area: (AREA_NAME[curArea?.id] || '').toUpperCase(), explored: Math.round(mapApi.pct() * 100), objective: settings.guidance !== 'off' ? stageNow().obj[0] : '' }),
  drawMap: (cv) => { const st = stageNow(); mapApi.draw(cv, { player: P.pos, yaw: P.yaw, target: settings.guidance !== 'off' && st.target ? st.target() : null, time: performance.now() / 1000 }); },
  applySettings, benchOptions: () => [], benchBuild: () => {},
  get creditsHTML() { return credits(); },
});
function equipItem(k) {
  const meleeKey = k === 'knife' || (P.melee && k === P.melee.id);
  const alreadyHeld = meleeKey ? P.weapon === 'melee' : k === 'bottle' || k === 'brick' ? P.weapon === 'throw' && throwKind() === k : P.weapon === k;
  if (alreadyHeld) { P.weapon = 'none'; toast('Item stowed · empty hands'); showInv(); return true; }
  if (k === 'pistol') P.weapon = 'pistol';
  else if (meleeKey) P.weapon = 'melee';
  else if (k === 'bottle' || k === 'brick') { if (P.items[k] <= 0) { toast(`No ${k}s`); return false; } P.weapon = 'throw'; P.throwPref = k; }
  else if (k === 'molotov') { if (!P.items.molotov) { toast('No molotov — craft one'); return false; } P.weapon = 'molotov'; }
  else return false;
  toast(`${ITEMS[k]?.name || k} in hand`); showInv(); audio.uiConfirm?.();
  if(k === 'pistol') tutorial?.signal('equip');
  return true;
}
function useHeld() {
  if(P.healT > 0 || P.craftT > 0 || P.packOpen) return;
  if(P.weapon === 'pistol') fire();
  else if(P.weapon === 'throw' || P.weapon === 'molotov') throwItem(P.weapon);
  else if(P.weapon === 'melee') melee();
  else toast('Empty hands · Tab to select an item');
}
function setPaused(on) { paused = on; if (audio.ok) audio.master.gain.setTargetAtTime(settings.master / 10 * (on ? 0.35 : 1), audio.ctx.currentTime, 0.08); }
function relock() { if (mode === 'play' && !ui.open && !P.dead) cv.requestPointerLock?.()?.catch?.(() => {}); }
function openPause() { if (ui.open || mode !== 'play' || P.dead) return; keys.clear(); mouseDown = [false, false, false]; setPaused(true); ui.openPause(); document.exitPointerLock?.(); }
function openPack() { if (ui.open || mode !== 'play' || P.dead || P.struggle) return; keys.clear(); P.aim = false; P.packOpen = true; tutorial?.signal('pack'); ui.openPack(); document.exitPointerLock?.(); }
function openMap() { if (ui.open || mode !== 'play' || P.dead) return; keys.clear(); setPaused(true); ui.openMap('game'); document.exitPointerLock?.(); }

// ------------------------------------------------------------------ input
const keys = new Set(); let mouseDown = [false, false, false], locked = false;
addEventListener('keydown', e => {
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (mode === 'title' && !titleReady) { if (!e.repeat) enterTitle(); return; }
  if (mode === 'trailer') { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') endTrailer(); return; }
  if (ui.open) { if (!e.repeat || /^(Arrow|Key[WASD]$)/.test(e.code)) ui.handleKey(e); return; }
  if (mode === 'end') { if (e.code === 'Enter' || e.code === 'Escape') toTitle(); return; }
  if (keys.has(e.code)) return; keys.add(e.code);
  if (mode !== 'play' || P.dead || paused) return;
  switch (e.code) {
    case 'Escape': case 'KeyP': openPause(); break;
    case 'Tab': case 'KeyI': openPack(); break;
    case 'KeyM': openMap(); break;
    case 'Enter': case 'NumpadEnter': useHeld(); break;
    case 'KeyT': if(tutorial?.active) tutorial.leave(); break;
    case 'Digit1': if(P.weapon !== 'pistol')equipItem('pistol'); break;
    case 'Digit4': if(P.weapon !== 'melee')equipItem(P.melee?.id || 'knife'); break;
    case 'Digit2': if (P.items.bottle + P.items.brick) P.weapon = 'throw'; else toast('No bottles or bricks'); showInv(); break;
    case 'Digit3': if (P.items.molotov) P.weapon = 'molotov'; else toast('No molotov — craft one (Tab)'); showInv(); break;
    case 'KeyC': P.crouch = !P.crouch; if(P.crouch)tutorial?.signal('crouch'); break;
    case 'KeyF': melee(); break;
    case 'KeyG': throwItem(P.weapon === 'molotov' ? 'molotov' : 'throw'); break;
    case 'KeyR': reload(); break;
    case 'KeyH': heal(); break;
    case 'KeyE': interact(); break;
    case 'KeyL': W.flashlightOn = !W.flashlightOn; audio.dryfire(); break;
    case 'KeyX': shoulder *= -1; break;
    case 'KeyO': gtao.enabled = !gtao.enabled; toast('Ambient occlusion ' + (gtao.enabled ? 'on' : 'off')); break;
    case 'Space': dodge(); break;
  }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseDown = [false, false, false]; });
const cv = renderer.domElement;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  mouseDown[e.button] = true;
  if (mode === 'play' && !locked && e.button === 0 && !P.aim && !ui.open) cv.requestPointerLock?.()?.catch?.(() => {});
  if (mode !== 'play' || P.dead || paused || ui.open) return;
  if (e.button === 0) useHeld();
});
addEventListener('mouseup', e => mouseDown[e.button] = false);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === cv;
  // Esc releases the mouse before the page sees the key: treat losing the lock mid-game as a pause request
  if (!locked && mode === 'play' && !ui.open && !P.dead && !paused && performance.now() - uiClosedAt > 400) openPause();
});
addEventListener('mousemove', e => {
  if (mode !== 'play' || P.dead || paused || ui.open) return;
  if (!locked && !mouseDown.some(Boolean)) return; // drag-to-look fallback
  const s = 0.0022 * (settings.sens / 5) * (P.aimK > 0.5 ? 0.55 : 1);
  camYaw -= e.movementX * s; camPitch = clamp(camPitch - e.movementY * s * (settings.invertY ? -1 : 1), -1.1, 0.85);
});
$('title').addEventListener('click', () => { if (mode === 'title' && !titleReady) enterTitle(); });
$('trailer')?.addEventListener('click', () => endTrailer());
function enterTitle() { titleReady = true; audio.init(); applySettings(settings); ui.showTitle(); }
function playTrailer(thenStart) {
  const v = $('trailer'); mode = 'trailer'; trailerThen = thenStart;
  if (!v || v.dataset.skip === '1') return endTrailer();
  v.style.display = 'block'; $('skip').style.display = 'block'; v.currentTime = 0;
  v.play().catch(() => endTrailer()); v.onended = endTrailer; v.onerror = endTrailer;
}
function endTrailer() {
  if (mode !== 'trailer') return; const v = $('trailer'); v.pause(); v.style.display = 'none'; $('skip').style.display = 'none';
  S.setMeta({ trailerSeen: true });
  if (trailerThen) startNew(slot?.carry); else { mode = 'title'; ui.showTitle(); }
}

// ------------------------------------------------------------------ sound events
function emitSound(x, z, r, kind, player) {
  const field = L.soundField(x, z, r * 1.5);
  for (const e of enemies) {
    if (!e.alive) continue; const [cx, cz] = L.cellOf(e.pos.x, e.pos.z);
    const d = Math.max(field[L.idx(cx, cz)], Math.hypot(e.pos.x - x, e.pos.z - z));
    const rr = r * e.cfg.hear; if (d <= rr) e.hear({ x, z, r: rr, kind, player }, d);
  }
  W.lastSound = { x, z, r, kind, t: W.time };
}
W.onAttack = (e) => {
  if (P.dead || P.struggle || flags.ending) return;
  if(tutorial?.active) { P.hp=Math.max(50,P.hp-10);audio.hurt();fx.blood(P.pos.clone().setY(1.2));e.stagger=1.5;e.atkCool=4;return; }
  if (P.iframe > 0) { e.stagger = 0.7; return; }
  if (ui.open === 'pack') ui.closePack();
  const mw = P.melee && MELEE[P.melee.id];
  if (mw?.parry && P.swingT > 0 && P.swingDur - P.swingT < 0.34 && e.cfg.grab !== 'kill') { // a well-timed swing deflects the lunge
    e.stagger = 1.8; e.atkCool = 2.6; audio.clang(e.headPos); fx.sparks(e.headPos); W.slowT = 0.5; shake(0.16, 0.2); wear(1);
    P.riposte = { e, t: 1.4 }; toast('Deflected — strike now'); return;
  }
  P.healT = 0; P.craftT = 0; P.craftWhat = null; P.reloadT = 0; P.aim = false; dropCarry();
  if (e.cfg.grab === 'kill') {
    P.lockT = 9; audio.scream(e.headPos, 'knocker', 1.2); audio.click(e.headPos, 8, 1.5); shake(0.6, 1.2); fx.blood(P.pos.clone().setY(1.4));
    e.stagger = 0; later(1.0, () => { P.hp = 0; die(e.type); }); return;
  }
  audio.sting('gasp', 0.8);
  P.struggle = { e, t: settings.difficulty === 'easy' ? 3.6 : settings.difficulty === 'hard' ? 1.8 : 2.4, n: 0, need: P.melee ? 4 : 7 }; audio.scream(e.headPos, e.type, 1); shake(0.25, 0.5); emitSound(P.pos.x, P.pos.z, 7, 'struggle', true);
};
W.onEngage = () => { if (W.time - (W.lastSting ?? -99) > 9) { W.lastSting = W.time; audio.sting('sting_detect', 0.75); } };
W.onEnemyDeath = (e) => { fx.blood(e.pos.clone().setY(1.2)); stats.kills++; if(e.id === 'practice-infected')tutorial?.signal('enemy'); };

// ------------------------------------------------------------------ actions
function animOnce(name, t) { P.anim = { name, t }; }
function fire() {
  if (P.fireCool > 0 || P.reloadT > 0 || P.struggle || P.lockT > 0 || P.carry) return;
  if (P.ammo <= 0) { audio.dryfire(); toast(P.spare ? 'R — reload' : 'Out of ammo'); P.fireCool = 0.3; return; }
  tutorial?.signal('fire'); shotPose = 0.6;
  P.ammo--; P.fireCool = 0.5; P.recoil = 1; P.lastFire = W.time; camPitch = clamp(camPitch + 0.045, -1.1, 0.85); camYaw += (Math.random() - 0.5) * 0.02; shake(0.08, 0.15);
  const gp = gunMesh.getWorldPosition(new THREE.Vector3()).addScaledVector(camFwd, 0.18); muzzle.position.copy(gp); muzzle.intensity = 30; setTimeout(() => muzzle.intensity = 0, 55);
  fx.sparks(gp); audio.gunshot(P.pos.clone().setY(1.4)); audio.casing(P.pos); emitSound(P.pos.x, P.pos.z, 34, 'gun', true);
  const spread = P.speed > 0.5 ? 0.025 : 0.006; const dir = camFwd.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
  const o = camera.position.clone(); let best = L.rayWall(o, dir, 60), hitE = null, head = false;
  for (const e of enemies) {
    if (!e.alive) continue;
    const hc = e.headPos; const oc = hc.clone().sub(o); const t = oc.dot(dir); if (t > 0) { const d2 = oc.lengthSq() - t * t; const hr = e.type === 'bigknocker' ? 0.3 : 0.19; if (d2 < hr * hr && t < best) { best = t; hitE = e; head = true; } }
    const dxz = Math.hypot(dir.x, dir.z); if (dxz < 1e-4) continue;
    const tb = ((e.pos.x - o.x) * dir.x + (e.pos.z - o.z) * dir.z) / (dxz * dxz);
    if (tb > 0 && tb < best) { const px = o.x + dir.x * tb, pz = o.z + dir.z * tb, py = o.y + dir.y * tb; if (Math.hypot(px - e.pos.x, pz - e.pos.z) < (e.type === 'bigknocker' ? 0.45 : 0.32) && py > 0.1 && py < e.cfg.headY - 0.12) { best = tb; hitE = e; head = false; } }
  }
  const hp = o.clone().addScaledVector(dir, best);
  if (hitE) { hitE.damage(1, head); fx.blood(hp); } else { fx.sparks(hp); fx.dust(hp, 10); audio.ricochet(hp); }
}
function reload() {
  if (P.reloadT > 0 || P.spare <= 0 || P.ammo >= 6 || P.struggle) return;
  P.reloadT = 1.6; audio.reload(P.pos.clone().setY(1.2)); emitSound(P.pos.x, P.pos.z, 3.5, 'reload', true);
}
function wear(n) {
  if (!P.melee) return; P.melee.dur -= n;
  if (P.melee.dur <= 0) { const nm = MELEE[P.melee.id].name; P.melee = null; audio.clang(P.pos.clone().setY(1.2)); fx.sparks(P.pos.clone().setY(1.2)); toast(`${nm} broke`); hudT = 0; }
}
function melee() {
  if (P.struggle) { P.struggle.n++; audio.swoosh(); shake(0.05, 0.08); return; }
  if (P.strikeT > 0 || P.lockT > 0 || P.carry) return;
  const w = P.melee ? MELEE[P.melee.id] : null;
  if (P.riposte && P.riposte.e.alive && P.riposte.e.pos.distanceTo(P.pos) < 2.8) { // finish a deflected infected
    const e = P.riposte.e; P.riposte = null; P.lockT = 0.7; P.strikeT = 0.7; P.yaw = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z); animOnce('stab', 0.7);
    later(0.2, () => { audio.swingHit('blade', e.headPos); fx.blood(e.headPos); fx.blood(e.headPos); e.die(); shake(0.2, 0.2); emitSound(P.pos.x, P.pos.z, 4, 'melee', true); });
    return;
  }
  const t = meleeTarget(w ? w.reach : 1.9);
  if (t && t.takedown) {
    const e = t.e;
    if (w && !t.needShiv) { // weapon execution from behind: one swing, a little louder than the knife
      P.lockT = 0.8; P.strikeT = 0.8; P.yaw = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z); animOnce('stab', 0.8); e.stagger = 2; e.speed = 0;
      later(0.28, () => { audio.swingHit(w.kind, e.headPos); fx.blood(e.headPos); e.die(); wear(1); shake(0.15, 0.15); emitSound(P.pos.x, P.pos.z, w.noise * 0.6, 'takedown', true); });
      return;
    }
    if (t.needShiv && P.items.shiv <= 0) { toast('Need a shiv to take down a Knocker (Tab to craft)'); return; }
    if (t.needShiv) { P.items.shiv--; showInv(); }
    P.lockT = 1.5; P.strikeT = 1.5; P.yaw = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z); animOnce('stab', 1.4);
    e.stagger = 2; e.speed = 0; audio.growl(e.headPos, 0.3);
    later(0.5, () => { audio.stab(e.headPos); fx.blood(e.headPos); }); later(1.0, () => { audio.stab(e.headPos); e.die(); emitSound(P.pos.x, P.pos.z, 2.5, 'takedown', true); });
    return;
  }
  const swing = w ? w.swing : 0.55;
  P.strikeT = swing; P.swingT = swing; P.swingDur = swing; audio.swoosh(); animOnce('stab', swing);
  if (t) {
    const e = t.e; P.yaw = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
    later(swing * 0.3, () => {
      if (!e.alive) return;
      const k = new THREE.Vector3(e.pos.x - P.pos.x, 0, e.pos.z - P.pos.z).normalize();
      if (w) {
        audio.swingHit(w.kind, e.headPos); fx.blood(e.pos.clone().setY(1.3)); if (w.kind === 'blade') fx.blood(e.headPos);
        e.damage(w.dmg, false); if (e.alive) { e.stagger = Math.max(e.stagger, w.stagger); if (w.bleed) e.bleed = 3; }
        e.pos.addScaledVector(k, w.knock); wear(1); shake(0.12, 0.15); emitSound(P.pos.x, P.pos.z, w.noise, 'melee', true);
      } else {
        audio.stab(e.headPos); fx.blood(e.pos.clone().setY(1.2)); e.damage(1, false); e.stagger = Math.max(e.stagger, 0.7); e.pos.addScaledVector(k, 0.4); emitSound(P.pos.x, P.pos.z, 5, 'melee', true);
      }
    });
  }
}
function meleeTarget(reach = 1.9) {
  let best = null, bd = reach;
  const fwd = P.aimK > 0.5 ? new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)) : new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  for (const e of enemies) {
    if (!e.alive) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d > bd) continue;
    if ((dx * fwd.x + dz * fwd.z) / d < 0.35 && d > 0.9) continue;
    const behind = Math.abs(angDiff(e.yaw, Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z))) > 1.9;
    const td = e.type !== 'bigknocker' && !e.aware() && e.state !== 'WAKING' && (behind || e.state === 'DORMANT' || e.stagger > 0.3);
    best = { e, takedown: td, needShiv: e.type === 'knocker' }; bd = d;
  }
  return best;
}
function throwItem(which) {
  if (P.struggle || P.lockT > 0 || P.carry) return;
  const tk = throwKind(); const kind = which === 'molotov' ? (P.items.molotov > 0 ? 'molotov' : null) : P.items[tk] > 0 ? tk : null;
  if (!kind) { toast(which === 'molotov' ? 'No molotov' : 'Nothing to throw'); return; }
  P.items[kind]--; showInv(); P.strikeT = 0.45; audio.swoosh(); animOnce('throw', 0.7); P.yaw = camYaw;
  if (P.weapon === 'molotov' && !P.items.molotov) P.weapon = 'pistol';
  if (P.weapon === 'throw' && !(P.items.bottle + P.items.brick)) P.weapon = 'pistol';
  const m = new THREE.Mesh(kind === 'brick' ? new THREE.BoxGeometry(0.22, 0.07, 0.11) : new THREE.CylinderGeometry(0.05, 0.05, 0.26, 8), kind === 'brick' ? pm(0x7a3a28, 1) : kind === 'molotov' ? pm(0x6a3a18, 0.15) : pm(0x2f5a38, 0.1));
  if (kind === 'molotov') { const wick = new THREE.PointLight(0xff8030, 3, 3, 2); m.add(wick); }
  m.position.copy(P.pos).add(new THREE.Vector3(0, 1.6, 0)); scene.add(m);
  const v = camFwd.clone().multiplyScalar(13); v.y += 3.2;
  projectiles.push({ m, v, kind, trail: 0 });
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.v.y -= 9.8 * dt; const prev = p.m.position.clone(); p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 12;
    p.trail += dt * (p.kind === 'molotov' ? 36 : 12);
    const trailCount = Math.floor(p.trail); p.trail -= trailCount;
    if (trailCount && p.kind === 'molotov') fx.emit(p.m.position, trailCount, { color: [1, 0.6, 0.2], spread: 0.2, up: 0.3, grav: -1, life: 0.3 });
    const q = p.m.position; const [cx, cz] = L.cellOf(q.x, q.z); let hit = q.y < 0.05 || q.y > L.WALL_H || L.blocksSight(cx, cz) || (L.tile(cx, cz) === 'H' && q.y < 1.4) || (L.tile(cx, cz) === 'M' && q.y < 2.4);
    let hitE = null; for (const e of enemies) if (e.alive && Math.hypot(e.pos.x - q.x, e.pos.z - q.z) < 0.45 && q.y < e.cfg.headY + 0.2) { hit = true; hitE = e; }
    if (!hit) continue;
    const at = hitE ? q.clone() : prev; at.y = Math.max(0.05, at.y);
    if (p.kind === 'molotov') { audio.smash(at); fx.glass(at); igniteAt(at); }
    else if (p.kind === 'bottle') { audio.smash(at); fx.glass(at); }
    else { audio.thud(at); fx.dust(at, 15); }
    if (hitE && p.kind !== 'molotov') { hitE.stagger = p.kind === 'brick' ? 1.8 : 1.4; hitE.damage(p.kind === 'brick' ? 1 : 0, false); if (hitE.alive && hitE.state !== 'COMBAT') hitE.engage({ x: P.pos.x, z: P.pos.z }); }
    else if (p.kind !== 'molotov') emitSound(at.x, at.z, 15, 'throw', false);
    scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); projectiles.splice(i, 1);
  }
}
function igniteAt(at) {
  const [cx, cz] = L.cellOf(at.x, at.z); const pos = L.walkable(cx, cz) ? new THREE.Vector3(at.x, 0.05, at.z) : new THREE.Vector3(...(() => { const n = L.nearestWalkable(cx, cz) || [cx, cz]; const c = L.center(...n); return [c.x, 0.05, c.z]; })());
  const light = new THREE.PointLight(0xff7a28, 14, 9, 1.6); light.position.copy(pos).setY(0.8); scene.add(light);
  fires.push({ pos, t: 5.5, light, flame: 0, smoke: 0 });
  scorch.ignite(pos);
  fx.sparks(pos.clone().setY(0.3)); fx.emit(pos, 45, {color: [1, 0.5, 0.08], spread: 3, up: 2, grav: 2, life: 0.65, speed: 1.5});
  audio.fire(pos, 5.5); emitSound(pos.x, pos.z, 14, 'fire', false); shake(0.1, 0.2);
}
function updateFires(dt) {
  scorch.update(dt);
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i]; f.t -= dt;
    f.light.intensity = (10 + Math.random() * 8) * Math.min(1, f.t);
    f.flame += dt * 180; f.smoke += dt * 18;
    const flames = Math.floor(f.flame); f.flame -= flames;
    const smoke = Math.floor(f.smoke); f.smoke -= smoke;
    fx.emit(f.pos, flames, { color: [1, 0.55 + Math.random() * 0.3, 0.15], spread: 2.2, up: 1.8, grav: -1.5, life: 0.7, speed: 1 });
    if (smoke) fx.emit(f.pos.clone().setY(1), smoke, { color: [0.15, 0.13, 0.12], spread: 1, up: 1, grav: -0.8, life: 2.5, speed: 0.6 });
    for (const e of enemies) {
      if (!e.alive || e.pos.distanceTo(f.pos) > 2.3) continue;
      e.burn = (e.burn || 0) + dt; e.stagger = Math.max(e.stagger, 0.2);
      if (!e.burnScream) { e.burnScream = true; audio.scream(e.headPos, e.type, 1.2); }
      const kill = { frenzied: 0.8, lurker: 0.8, knocker: 1.6, bigknocker: 3.5 }[e.type];
      if (e.burn > kill) e.die();
    }
    if (!P.dead && P.pos.distanceTo(f.pos) < 1.8) { P.hp -= 28 * dt * incomingDamage(); if (P.hp <= 0) die('fire'); }
    if (f.t <= 0) { scene.remove(f.light); fires.splice(i, 1); }
  }
}
function heal() { if (P.items.kit <= 0) { toast('No health kit'); return; } if (P.hp >= 100 || P.healT > 0) return; P.healT = 2.2; P.aim=false; audio.pickup();toast('Applying antiseptic and wrapping · 2.2 seconds'); }
function startCraft(r) {
  if (!r || P.craftT > 0 || P.struggle) return;
  if (!canCraft(r)) { toast(P.items[r.id] >= r.max ? `Can't carry more ${NAME[r.id].toLowerCase()}s` : `Missing materials for ${NAME[r.id].toLowerCase()}`); return; }
  P.craftT = r.t; P.craftWhat = r.id; audio.pickup(); hudT = 0;
}
function dodge() {
  if (P.dodgeCool > 0 || P.lockT > 0 || P.carry) return;
  if (P.struggle) { if (P.struggle.t > 2.1) { P.struggle.e.stagger = 1; P.struggle = null; } else return; }
  const f = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)), r = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
  const d = new THREE.Vector3(); if (keys.has('KeyW')) d.add(f); if (keys.has('KeyS')) d.sub(f); if (keys.has('KeyD')) d.add(r); if (keys.has('KeyA')) d.sub(r); if (d.lengthSq() < 0.01) d.copy(f).negate();
  P.dodgeDir.copy(d.normalize()); P.dodgeT = 0.3; P.iframe = 0.35; P.dodgeCool = 0.9; audio.swoosh(); tutorial?.signal('dodge'); emitSound(P.pos.x, P.pos.z, 3, 'step', true);
}
// -- environment puzzles
function plankHome() { return world.plank.position; }
function dropCarry() {
  if (P.carry !== 'plank') return; P.carry = null;
  const pl = world.plank; carryMesh.remove(pl); scene.add(pl); pl.position.set(P.pos.x + Math.sin(P.yaw) * 0.6, 0.05, P.pos.z + Math.cos(P.yaw) * 0.6); pl.rotation.set(0, P.yaw + Math.PI / 2, 0); audio.thud(pl.position); emitSound(P.pos.x, P.pos.z, 6, 'drop', true);
}
function nearbyInteract() {
  let best = null, bd = 2.2;
  const near = (x, z, r) => Math.hypot(x - P.pos.x, z - P.pos.z) < r;
  if (P.carry === 'plank') {
    const pc = world.pitCenter; if (!L.obstacles.plankPlaced && near(pc.x, pc.z, 3.2)) return { kind: 'placePlank', label: 'Lay the plank across' };
    return { kind: 'dropPlank', label: 'Drop the plank' };
  }
  for (const d of L.doors.values()) { if (d.open) continue; const c = L.center(d.x, d.z); const dd = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (dd < bd) { bd = dd; best = { kind: 'door', d, label: d.locked ? (d.kind === 'L' ? 'Sealed by growth' : 'Locked') : 'Open' }; } }
  bd = Math.min(bd, 1.7);
  for (const p of L.PICKUPS) { if (taken.has(p.id) || !noteVisible(p)) continue; const g = pickMeshes.get(p.id).position; const dd = Math.hypot(g.x - P.pos.x, g.z - P.pos.z); if (dd < bd) { bd = dd; best = { kind: 'pickup', p, label: NAME[p.kind] }; } }
  if (!L.obstacles.plankPlaced && world.plank.parent === scene && near(world.plank.position.x, world.plank.position.z, 1.8)) best = { kind: 'plank', label: 'Pick up plank' };
  const gc = L.center(L.GENERATOR.x, L.GENERATOR.z); if (!L.obstacles.shutterOpen && !flags.genOn && near(gc.x, gc.z, 2.2)) best = { kind: 'generator', label: 'Start generator (loud)' };
  if (!L.obstacles.shutterOpen) { const sc = L.center(L.SHUTTER.x, L.SHUTTER.z); if (near(sc.x, sc.z, 2.2) && !best) best = { kind: 'shutter', label: 'Shutter — needs power' }; }
  for (let z = 0; z < L.H; z++) for (let x = 0; x < L.W; x++) if (L.grid[z][x] === 'O') { const c = L.center(x, z); if (Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 1.9) best = { kind: 'hole', label: 'Drop down' }; }
  { const pc = world.pitCenter; if (!L.obstacles.plankPlaced && near(pc.x, pc.z, 2.4) && !best) { best = { kind: 'pit', label: 'Too wide to jump — a loose plank was in the pharmacy storeroom' }; if (!flags.pitHint) { flags.pitHint = true; objective('Bridge the collapsed floor', 'Fetch the plank from the pharmacy storeroom'); subtitle('Too far to jump… there was a plank leaning in the pharmacy storeroom.', 4); } } }
  return best;
}
function interact() {
  if(tutorial?.active) {
    const it=nearbyInteract();
    if(it?.kind==='pickup' && it.p.training) {
      taken.add(it.p.id);pickMeshes.get(it.p.id).visible=false;P.items[it.p.kind]++;
      audio.pickup();toast(`Found ${NAME[it.p.kind]} · check Materials in Tab`);animOnce('pickup',.8);P.pickT=.6;
    } else toast('Follow the gold supply markers · T skips practice');
    return;
  }
  const it = nearbyInteract(); if (!it || P.lockT > 0) return;
  if (it.kind === 'door') { if (it.d.locked) { audio.thud(P.pos); return; } openDoor(it.d, true); }
  else if (it.kind === 'pickup') {
    const p = it.p; taken.add(p.id); pickMeshes.get(p.id).visible = false; P.pickT = 0.6; animOnce('pickup', 0.8); audio.pickup();
    if (p.kind === 'ammo') { P.spare += p.n; toast(`+${p.n} pistol ammo`); }
    else if (p.kind === 'med') { toast('Medical supplies'); startEscape(); }
    else if (p.kind === 'note') { notesFound.add(p.id); keys.clear(); setPaused(true); document.exitPointerLock?.(); ui.openNotes('game', p.id); }
    else if (MELEE[p.kind]) {
      if (P.melee) dropMelee();
      P.melee = { id: p.kind, dur: p.dur ?? MELEE[p.kind].dur }; audio.draw(P.pos.clone().setY(1)); toast(`${MELEE[p.kind].name} — ${MELEE[p.kind].blurb}`); hudT = 0; showInv();
    }
    else { P.items[p.kind]++; toast(`+1 ${NAME[p.kind].toLowerCase()}`); showInv(); }
  }
  else if (it.kind === 'plank') { P.carry = 'plank'; P.aim = false; const pl = world.plank; scene.remove(pl); carryMesh.add(pl); pl.position.set(0.15, 0.95, 0.35); pl.rotation.set(0, 0, 0); pl.rotation.y = 0; audio.pickup(); toast('Carrying plank — slower, no weapons'); objective('Bridge the collapsed floor', 'Carry it to the hole in the service corridor · E to lay it'); }
  else if (it.kind === 'placePlank') {
    P.carry = null; const pl = world.plank; carryMesh.remove(pl); scene.add(pl); const pc = world.pitCenter;
    pl.position.set(pc.x, 0.06, pc.z); pl.rotation.set(0, Math.PI / 2, 0); L.obstacles.plankPlaced = true; animOnce('push', 1.0); P.lockT = 0.9;
    audio.thud(new THREE.Vector3(pc.x, 0.1, pc.z)); emitSound(pc.x, pc.z, 7, 'plank', true); subtitle('That should hold… hopefully.', 2); objective('Follow the service corridor', 'Cross the plank and squeeze through at the end');
  }
  else if (it.kind === 'dropPlank') dropCarry();
  else if (it.kind === 'generator') startGenerator();
  else if (it.kind === 'shutter') { audio.thud(P.pos); subtitle('Rolling shutter. There was a generator back there…', 2.5); }
  else if (it.kind === 'hole') dropToNest();
}
let dynId = 0;
function spawnDrop(d) {
  const p = { ...d }; L.PICKUPS.push(p);
  const g = new THREE.Group(); g.position.set(p.px, 0, p.pz); const m = buildMelee(p.kind); m.rotation.y = p.ry || 0; m.position.y = 0.03; g.add(m); scene.add(g); pickMeshes.set(p.id, g); return g;
}
function dropMelee() {
  const [cx, cz] = L.cellOf(P.pos.x, P.pos.z);
  const g = spawnDrop({ id: `drop${++dynId}_${Date.now().toString(36)}`, kind: P.melee.id, dur: P.melee.dur, x: cx, z: cz, px: P.pos.x + Math.sin(P.yaw) * 0.5, pz: P.pos.z + Math.cos(P.yaw) * 0.5, ry: Math.random() * 6, dyn: true });
  audio.thud(g.position); P.melee = null;
}
function startGenerator() {
  flags.genOn = true; P.lockT = 1.8; animOnce('push', 1.6); const gc = L.center(L.GENERATOR.x, L.GENERATOR.z); const gp = new THREE.Vector3(gc.x, 0.6, gc.z);
  audio.pullcord(gp); later(0.7, () => audio.pullcord(gp)); later(1.5, () => { audio.engine(gp, 14); emitSound(gc.x, gc.z, 24, 'generator', false); shake(0.06, 1); world.storeLamp.intensity = 6; subtitle('Loud. Too loud.', 2); objective('Get the medical supplies', 'The shutter is rising — storeroom in the right wall'); });
  genT = 14;
}
function openDoor(d, byPlayer) {
  d.open = true; const c = L.center(d.x, d.z);
  if (d.kind === 'L') { world.lMass.visible = false; audio.tear(new THREE.Vector3(c.x, 1.5, c.z)); fx.spores(new THREE.Vector3(c.x, 1.5, c.z), 90); fx.dust(new THREE.Vector3(c.x, 1.5, c.z), 50); return; }
  d.anim = 0;
  const metal = d.x === 11 || d.kind === 'E';
  audio.door(new THREE.Vector3(c.x, 1.2, c.z), metal);
  if (byPlayer) emitSound(c.x, c.z, metal ? 8 : 4, 'door', true);
  if (d.x === 11 && !flags.doorReact) { flags.doorReact = true; P.flinch = 1; later(0.9, () => subtitle('…too loud.', 2)); }
}
function shake(a, t) { const m = SHAKE[settings.shake] ?? 1; if (!m) return; shakeAmp = Math.max(shakeAmp, a * m); shakeT = Math.max(shakeT, t); }

// ------------------------------------------------------------------ flow
const AREA_LOOK = {
  street:    { fog: 0x4a545c, d: 0.042, sky: 0x8a9ab0, gnd: 0x2c2a26, i: 1.2, moon: 0.5, sat: 0.78, tint: [0.96, 1.0, 1.05] },
  outside:   { fog: 0x4a545c, d: 0.038, sky: 0x8a9ab0, gnd: 0x2c2a26, i: 1.2, moon: 0.5, sat: 0.78, tint: [0.96, 1.0, 1.05] },
  pharmacy:  { fog: 0x27302a, d: 0.055, sky: 0x7a9a86, gnd: 0x1a1c18, i: 0.45, moon: 0.08, sat: 0.72, tint: [0.95, 1.04, 0.97] },
  corridor:  { fog: 0x0c0e10, d: 0.075, sky: 0x4a5058, gnd: 0x141210, i: 0.16, moon: 0, sat: 0.7, tint: [1, 1, 1] },
  apartment: { fog: 0x141418, d: 0.065, sky: 0x607080, gnd: 0x141210, i: 0.2, moon: 0.03, sat: 0.7, tint: [1, 0.99, 0.97] },
  nest:      { fog: 0x22140a, d: 0.07, sky: 0x9a6a3a, gnd: 0x1a0e06, i: 0.18, moon: 0, sat: 0.9, tint: [1.08, 0.98, 0.86] },
  escape:    { fog: 0x100c0a, d: 0.08, sky: 0x504040, gnd: 0x0a0806, i: 0.1, moon: 0, sat: 0.8, tint: [1, 1, 1] },
  escapeRed: { fog: 0x1c0505, d: 0.07, sky: 0x803030, gnd: 0x100404, i: 0.16, moon: 0, sat: 0.85, tint: [1.1, 0.92, 0.9] },
};
const col = new THREE.Color(), col2 = new THREE.Color();
function applyLook(dt, lightning) {
  const a = curArea ? curArea.id : 'street'; const k = AREA_LOOK[a === 'escape' && flags.escape ? 'escapeRed' : a]; const t = Math.min(1, dt * 1.2);
  col.setHex(k.fog); scene.fog.color.lerp(col, t); scene.background.copy(scene.fog.color);
  scene.fog.density = lerp(scene.fog.density, k.d * (P.listen ? 1.15 : 1), t);
  col2.setHex(k.sky); hemi.color.lerp(col2, t); col2.setHex(k.gnd); hemi.groundColor.lerp(col2, t);
  hemi.intensity = lerp(hemi.intensity, k.i, t) + lightning * (curArea?.outside ? 3 : 0.5);
  moon.intensity = lerp(moon.intensity, k.moon, t) + lightning * (curArea?.outside ? 2 : 0.2);
  grade.uniforms.sat.value = lerp(grade.uniforms.sat.value, P.listen ? 0.12 : k.sat, t * 2);
  grade.uniforms.tint.value.lerp(col.setRGB(...k.tint), t);
  const ek = AREA_ENV[a] ?? 0.5; if (Math.abs(ek - envK) > 0.005) { envK = lerp(envK, ek, t); for (const m of envMats) m.envMapIntensity = m.userData.envBase * envK; }
}
function onEnterArea(id) {
  if (id === 'pharmacy' && !flags.pharmacy) { flags.pharmacy = true; checkpoint('pharmacy'); later(2.5, () => { if (!flags.corridor && !flags.pitHint) objective('Find the clinic stock', 'Through the back of the pharmacy, past the shelves'); }); }
  if (id === 'corridor' && !flags.corridor) { flags.corridor = true; subtitle('Shelves were stripped. The clinic stock went further in.', 3.5); objective('Follow the service corridor', 'Toward the apartments east of the pharmacy'); if (!W.flashlightOn) later(1.2, () => { W.flashlightOn = true; audio.dryfire(); }); }
  if (id === 'apartment' && !flags.aptEntered) { flags.aptEntered = true; later(1.7, () => audio.sting('sting_dark_1', 0.65)); checkpoint('apartment'); objective('Find a way down', 'Look for an orange glow through the floor — far corner room'); ambT = 14; }
}
function dropToNest() {
  if (flags.dropped) return; P.lockT = 1.6; fade(1, 0.5);
  later(0.6, () => {
    flags.dropped = true; const c = L.center(L.NEST_LANDING.x, L.NEST_LANDING.z); P.pos.set(c.x, 0, c.z); P.vel.set(0, 0, 0); camYaw = Math.PI / 2; camPitch = -0.1; P.yaw = camYaw;
    audio.thud(P.pos); fx.dust(P.pos.clone().setY(0.4), 40); shake(0.25, 0.4); P.hp = Math.max(1, P.hp - 5); W.flashlightOn = true;
    checkpoint('nest'); fade(0, 1.4); later(1.5, () => objective('Cross the nest', 'Stay crouched off the fungus · generator at the far end, lower lane'));
  });
}
function bigMoment(at) {
  flags.crackDone = true; P.lockT = 1.6; P.vel.set(0, 0, 0); later(0.15, () => audio.sting('gasp', 0.7)); later(0.6, () => audio.sting('braam', 0.8));
  audio.crack(at); audio.silence(4.5); fx.dust(at.clone().setY(0.2), 60); shake(0.12, 0.3);
  const big = enemies.find(e => e.id === 'big' && e.alive);
  if (big) { big.target = { x: at.x, z: at.z }; big.setState('SUSPICIOUS'); big.stateT = -2.2; big.clickT = 99;
    later(1.4, () => audio.click(big.headPos, 1, 1.2)); later(2.0, () => audio.click(big.headPos, 1, 1.2)); later(2.5, () => audio.click(big.headPos, 2, 1.3)); later(3.2, () => { big.clickT = 0.5; }); }
  const dorm = enemies.filter(e => e.state === 'DORMANT' && e.alive).sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at))[0];
  if (dorm) later(2.4, () => { if (dorm.state === 'DORMANT') dorm.wake({ x: at.x, z: at.z }); });
}
function startEscape() {
  flags.escape = true; objective('GET OUT', 'Back west along the lower lane to the torn wall — follow the red light'); audio.sting('braam', 1); audio.tear(P.pos.clone().setY(1.5)); shake(0.35, 2.2); fx.spores(P.pos.clone().setY(2), 120); fx.dust(P.pos.clone().setY(3), 40);
  say('The walls are moving—', 2.2); later(2.6, () => say('The wall back there tore open. Go. Go!', 3));
  emitSound(P.pos.x, P.pos.z, 60, 'tear', false);
  for (const e of enemies) if (e.state === 'DORMANT' && e.alive) later(0.5 + Math.random() * 3, () => e.state === 'DORMANT' && e.wake({ x: P.pos.x, z: P.pos.z }));
  openDoor(L.doorAt(37, 24), false); L.doorAt(37, 24).locked = false; L.doorAt(14, 23).locked = false;
  for (const def of L.ESCAPE_SPAWNS) { const e = new Enemy(def, W); enemies.push(e); registerEnv(e.h.root); }
  const runner = enemies.find(e => e.id === 'e1'); if (runner) { runner.engage({ x: P.pos.x, z: P.pos.z }); later(0.2, () => audio.scream(runner.headPos, 'frenzied', 1.2)); }
  flags.escT = [{ x: 33, z: 24, done: false }, { x: 28, z: 25, done: false }, { x: 21, z: 24, done: false }, { x: 30, z: 21, done: false }, { x: 18, z: 22, done: false }];
  later(0.3, () => checkpoint('escape'));
}
function escapeSetpieces() {
  for (const t of flags.escT || []) {
    if (t.done) continue; const c = L.center(t.x, t.z); if (Math.hypot(c.x - P.pos.x, c.z - P.pos.z) > 3.5) continue; t.done = true;
    const ahead = new THREE.Vector3(c.x - 2.5, 0, c.z);
    fx.dropDebris(ahead.x + (Math.random() - 0.5), ahead.z + (Math.random() - 0.5), 0.7); later(0.25, () => fx.dropDebris(ahead.x - 1, ahead.z + 0.4, 0.4));
    audio.debris(ahead.clone().setY(3)); shake(0.2, 0.6); fx.spores(ahead.clone().setY(3.5), 40);
    world.escapeLights.forEach(l => l.kill = 0.6 + Math.random());
  }
}
function startEnding() {
  flags.ending = true; mode = 'ending'; endT = 0; P.aim = false; P.crouch = false; P.packOpen = false; $('objective').style.opacity = 0; W.flashlightOn = false;
  flags.endStart = P.pos.clone();
}
function updateEnding(dt) {
  endT += dt; const t = endT;
  let speed = 0, pose = null, headPitch = 0, headYaw = 0;
  if (t < 2.4) { const target = flags.endStart.x - 8; const dx = target - P.pos.x; speed = clamp(dx < -0.3 ? 3.8 * Math.min(1, -dx / 3) : 0, 0, 3.8); P.pos.x -= speed * dt; P.yaw += angDiff(P.yaw, -Math.PI / 2) * Math.min(1, dt * 6); if (Math.random() < dt * 3) audio.step('w', 0.6, P.pos); if (Math.random() < dt * 2) audio.breath(0.5); }
  else { P.yaw += angDiff(P.yaw, Math.PI / 2) * Math.min(1, dt * 1.8); if (Math.random() < dt * 0.8 && t < 5) audio.breath(0.35); }
  if (t > 3.6 && t < 7.2) { headPitch = 0.55; headYaw = -0.3; }
  if (t > 3.6) strandMesh.visible = t < 6.2;
  if (t > 4.6 && t < 6.6) pose = 'pull';
  if (t > 6.2 && !flags.strandDropped) { flags.strandDropped = true; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 })); strandMesh.getWorldPosition(s.position); scene.add(s); flags.fallStrand = s; }
  if (flags.fallStrand && flags.fallStrand.position.y > 0.01) { flags.fallStrand.position.y -= dt * 0.9; flags.fallStrand.rotation.z += dt * 3; }
  if (t > 5.2 && !flags.owl) { flags.owl = true; audio.sting('owl', 0.35); }
  if (t > 8.6 && !flags.farClick) { flags.farClick = true; audio.click(new THREE.Vector3(P.pos.x + 30, 2, P.pos.z), 3, 0.35); }
  if (t > 10.6 && mode === 'ending') { mode = 'end'; markComplete(); const f = $('fade'); f.style.transition = 'none'; f.style.opacity = 1; audio.silence(99); setTimeout(() => { $('end').style.display = 'flex'; requestAnimationFrame(() => { $('end').querySelector('h1').style.opacity = 1; $('end').querySelectorAll('p').forEach((p, i) => p.style.opacity = i ? 0.45 : 0.6); }); }, 1400); }
  if (heroC?.ok) {
    heroC.root.position.copy(P.pos); heroC.root.rotation.y = P.yaw;
    const clip = speed > 2 ? 'run' : speed > 0.2 ? 'walk' : (t > 4.6 && t < 6.4) ? 'crouchidle' : 'idle';
    heroC.play(clip, { fade: 0.4 }); if (clip === 'run') heroC.speed(speed / 4.6); heroC.update(dt);
  } else { animate(hero, { dt, speed, crouch: 0, aim: 0, run: speed > 2 ? 1 : 0, pose, headPitch, headYaw }); hero.root.position.copy(P.pos); hero.root.rotation.y = P.yaw; }
  const head = P.pos.clone().setY(1.45);
  let cp;
  if (t < 2.6) cp = P.pos.clone().add(new THREE.Vector3(2.4, 1.6, 0.6));
  else { const k = clamp((t - 2.6) / 7, 0, 1); const e = k * k * (3 - 2 * k); cp = P.pos.clone().add(new THREE.Vector3(lerp(-2.6, -1.05, e), lerp(1.7, 1.45, e), lerp(0.9, 0.35, e))); }
  camera.position.lerp(cp, Math.min(1, dt * 2)); const look = t > 3.8 && t < 6.8 ? P.pos.clone().setY(1.05).lerp(head, 0.3) : head; camera.lookAt(look);
  camera.fov = lerp(camera.fov, 44, dt); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ checkpoints / death
const DEFS = new Map([...L.ENEMIES, ...L.ESCAPE_SPAWNS].map(d => [d.id, d]));
function snapshot(name) { // plain JSON: ids instead of live objects, so it fits in localStorage
  return { v: 1, name, label: CP_NAME[name] || name, at: Date.now(), pos: [P.pos.x, P.pos.z], yaw: camYaw, hp: Math.max(P.hp, 60), ammo: P.ammo, spare: P.spare, items: { ...P.items }, melee: P.melee ? { ...P.melee } : null, upgrades: [...P.upgrades], magSize: P.magSize,
    flags: JSON.parse(JSON.stringify(flags, (k, v) => (k === 'fallStrand' || k === 'endStart') ? undefined : v)), taken: [...taken], drops: L.PICKUPS.filter(p => p.dyn && !taken.has(p.id)).map(p => ({ ...p })),
    doors: [...L.doors.entries()].map(([k, d]) => [k, d.open, d.locked]), enemies: enemies.filter(e => e.alive).map(e => e.id), flash: W.flashlightOn, obstacles: { ...L.obstacles },
    plank: { pos: world.plank.position.toArray(), rotY: world.plank.rotation.y, carried: P.carry === 'plank' }, map: mapApi.save(), notes: [...notesFound], stats: { ...stats } };
}
function checkpoint(name) {
  if(tutorial?.active)return;
  saved = snapshot(name);
  if (slot) { slot.snap = saved; slot.checkpoint = saved.label; slot.area = AREA_NAME[curArea?.id] || saved.label; slot.progress = progressPct(); slot.playtime = playT; S.upsertSlot(slot); if (mode === 'play' && name !== 'start') ui.flashSave(); }
}
function restoreSnap(sn, fromSave = false) {
  gen++; paused = false; P.packOpen = false;
  for (const e of enemies) e.dispose(); enemies.length = 0;
  for (const id of sn.enemies) { const d = DEFS.get(id); if (!d) continue; const e = new Enemy(d, W); enemies.push(e); registerEnv(e.h.root); }
  for (const k in flags) delete flags[k]; Object.assign(flags, JSON.parse(JSON.stringify(sn.flags)));
  for (const [k, open, locked] of sn.doors) { const d = L.doors.get(k); if (d) { d.open = open; d.locked = locked; setDoorVisual(d); } }
  Object.assign(L.obstacles, sn.obstacles); setShutter(L.obstacles.shutterOpen ? 1 : 0); world.storeLamp.intensity = L.obstacles.shutterOpen ? 6 : 0; genT = 0; audio.stopEngine?.(); audio.duckT = 0;
  P.carry = null; carryMesh.remove(world.plank); scene.add(world.plank); world.plank.position.fromArray(sn.plank.pos); world.plank.rotation.set(0, sn.plank.rotY, 0);
  if (sn.plank.carried) { P.carry = 'plank'; scene.remove(world.plank); carryMesh.add(world.plank); world.plank.position.set(0.15, 0.95, 0.35); world.plank.rotation.set(0, 0, 0); }
  for (let i = L.PICKUPS.length - 1; i >= 0; i--) if (L.PICKUPS[i].dyn) { const d = L.PICKUPS.splice(i, 1)[0]; const g = pickMeshes.get(d.id); if (g) scene.remove(g); pickMeshes.delete(d.id); }
  taken = new Set(sn.taken); for (const d of sn.drops || []) spawnDrop(d);
  for (const p of L.PICKUPS) { const g = pickMeshes.get(p.id); if (g) g.visible = !taken.has(p.id) && noteVisible(p); }
  P.pos.set(sn.pos[0], 0, sn.pos[1]); P.vel.set(0, 0, 0); camYaw = sn.yaw; P.yaw = camYaw; camPitch = -0.08; P.hp = sn.hp; P.ammo = sn.ammo; P.spare = sn.spare; P.items = { scrap: 0, ...sn.items }; P.melee = sn.melee ? { ...sn.melee } : null; P.riposte = null;
  P.upgrades = [...(sn.upgrades || [])]; P.magSize = sn.magSize || 6;
  if (fromSave) { notesFound = new Set(sn.notes || []); mapApi.load(sn.map); Object.assign(stats, sn.stats || {}); }
  P.dead = false; P.struggle = null; P.lockT = 0; P.healT = P.craftT = P.reloadT = 0; P.craftWhat = null; P.crouch = false; P.anim = null; W.flashlightOn = sn.flash; P.weapon = 'pistol';
  for (const p of projectiles) scene.remove(p.m); projectiles = [];
  for (const f of fires) scene.remove(f.light); fires = []; fx.clear(); scorch.reset();
  curArea = L.areaAt(P.pos.x, P.pos.z); camPivot.set(P.pos.x, 1.5, P.pos.z); audio.intensity = 1; stageId = null;
  heroC?.play('idle', { fade: 0, restart: true });
  saved = sn;
}
const DEATH = {
  knocker: ['A Knocker found you.', 'They hunt by sound alone. Crouch-walk past, or come from behind with a shiv.'],
  bigknocker: ['The big one heard you.', 'It follows footsteps. Throw a bottle the other way, then move.'],
  frenzied: ['The Frenzied tore you down.', 'Break line of sight and they lose you. A brick buys you a second.'],
  lurker: ['A Lurker came from behind.', 'Lurkers freeze when watched. Keep a wall at your back and listen with Q.'],
  fire: ['You burned.', 'Throw molotovs far — the fire spreads.'],
  default: ['You died.', 'Every sound carries. Slow down.'],
};
function die(cause = 'default') {
  if (P.dead) return; P.dead = true; P.struggle = null; audio.hurt(); dropCarry(); stats.deaths++;
  if (ui.open === 'pack') ui.closePack(); ui.guide(false);
  later(1.7, () => { fade(0.62, 1.1); later(1.0, () => { paused = true; document.exitPointerLock?.(); const [why, tip] = DEATH[cause] || DEATH.default;
    ui.openDeath({ title: 'YOU DIED', why: `${why}<br><span style="font-size:13px;font-style:normal;opacity:.75">${tip}</span>`, checkpoint: saved?.label, at: saved?.at, deaths: stats.deaths }); }); });
}
function onRetry() { fade(1, 0.3); setTimeout(() => { restoreSnap(saved); mode = 'play'; fade(0, 0.9); showStageObjective(); relock(); }, 350); }
function startNew(carry) {
  tutorial?.stop();
  W.cycle = slot?.cycle || 0; restoreSnap(initialSnap, true);
  if (carry?.melee) P.melee = { id: carry.melee.id, dur: MELEE[carry.melee.id].dur };
  if (carry?.upgrades) P.upgrades = [...carry.upgrades];
  mode = 'play'; playT = slot?.playtime || 0; $('objective').style.opacity = 0;
  fade(1, 0); requestAnimationFrame(() => fade(0, 3.5));
  later(4.5, () => objective('Search the pharmacy', 'Green cross across the street'));
  later(9, () => toast('Tab — backpack · M — map · Esc — pause'));
  checkpoint('start'); relock();
}
function onNewGame(skipPractice=false) { if(!skipPractice && !S.getMeta().practiceSeen){startPractice();return;} slot = S.newSlot(); if (!S.getMeta().trailerSeen) playTrailer(true); else startNew(); }
function onContinue(sl) {
  tutorial?.stop();
  slot = sl; S.setMeta({ lastSlot: sl.id }); W.cycle = sl.cycle || 0;
  restoreSnap(sl.snap || initialSnap, true); playT = sl.playtime || 0; mode = 'play';
  fade(1, 0); requestAnimationFrame(() => fade(0, 1.6)); showStageObjective(); relock();
}
function onNewStoryPlus(sl) {
  const fin = sl.final || {}; const base = sl.name.replace(/ · Story \d+$/, '');
  slot = S.newSlot({ cycle: (sl.cycle || 0) + 1, carry: { melee: fin.melee || null, upgrades: fin.upgrades || [] }, name: `${base} · Story ${(sl.cycle || 0) + 2}` });
  startNew(slot.carry);
}
function markComplete() { if (!slot) return; slot.completed = true; slot.progress = 100; slot.playtime = playT; slot.final = { melee: P.melee ? { ...P.melee } : null, upgrades: [...P.upgrades] }; S.upsertSlot(slot); S.setMeta({ completedAny: true }); }
function toTitle(view = 'main') {
  tutorial?.stop();
  if (slot && (mode === 'play' || mode === 'ending')) { slot.playtime = playT; S.upsertSlot(slot); }
  document.exitPointerLock?.(); P.packOpen = false; ui.guide(false); fade(1, 0.35);
  setTimeout(() => { mode = 'title'; paused = false; gen++; audio.stopEngine?.(); setPaused(false);
    $('end').style.display = 'none'; $('end').querySelector('h1').style.opacity = 0; $('end').querySelectorAll('p').forEach(p => p.style.opacity = 0);
    for (const id of ['objective', 'prompt', 'sub']) $(id).style.opacity = 0;
    ui.showTitle(view); fade(0, 0.6); }, 380);
}
function setDoorVisual(d) {
  if (d.kind === 'L') { world.lMass.visible = !d.open; return; }
  d.anim = d.open ? 1 : 0; d.mesh.rotation.y = d.open ? -1.7 : 0;
}
function setShutter(k) { world.shutter.position.y = k * 2.5; }
// ------------------------------------------------------------------ update
const clock = new THREE.Clock();
function update(dt) {
  W.time += dt; grade.uniforms.time.value = W.time % 100;
  if (mode === 'ending') { updateEnding(dt); commonWorld(dt, 0); return; }
  if (mode !== 'play') { commonWorld(dt, 0); return; }
  for (const k of ['lockT', 'strikeT', 'fireCool', 'dodgeT', 'dodgeCool', 'iframe', 'pickT', 'swingT']) P[k] = Math.max(0, P[k] - dt);
  playT += dt;
  if (settings.keyLook && !P.dead) { const ks = 2.1 * (settings.sens / 5) * (P.aimK > 0.5 ? 0.5 : 1); if (keys.has('ArrowLeft')) camYaw += ks * dt; if (keys.has('ArrowRight')) camYaw -= ks * dt; const ps = ks * 0.6 * (settings.invertY ? -1 : 1); if (keys.has('ArrowUp')) camPitch = clamp(camPitch + ps * dt, -1.1, 0.85); if (keys.has('ArrowDown')) camPitch = clamp(camPitch - ps * dt, -1.1, 0.85); }
  if (flags.escape && !flags.pastTear && L.cellOf(P.pos.x, P.pos.z)[0] <= 36) { flags.pastTear = true; objective('GET OUT', 'Follow the red lights west to the EXIT door'); }
  mapApi.reveal(P.pos.x, P.pos.z, dt); if(!tutorial?.active)updateGuide(dt);
  tutorial?.update(dt,P); if($('practiceGuide'))$('practiceGuide').style.visibility=P.packOpen?'hidden':'visible'; shotPose=Math.max(0,shotPose-dt);
  if (P.anim) { P.anim.t -= dt; if (P.anim.t <= 0) P.anim = null; }
  if (P.riposte) { P.riposte.t -= dt; if (P.riposte.t <= 0) P.riposte = null; }
  // bleeding infected (machete): blood trail, then the wound finishes them
  for (const e of enemies) if (e.bleed > 0 && e.alive) { e.bleed -= dt; if (Math.random() < dt * 3) fx.decal(e.pos.x, e.pos.z, 0.12 + Math.random() * 0.1); if (e.bleed <= 0) e.damage(1, false); }
  // heartbeat when badly hurt; ragged hiding breath while listening near a Lurker
  if (P.hp < 35 && !P.dead) { P.hbT = (P.hbT ?? 0) - dt; if (P.hbT <= 0) { P.hbT = 0.75 + P.hp / 60; audio.heartbeat(0.55); } }
  if (P.listen) { P.brT = (P.brT ?? 0) - dt; if (P.brT <= 0 && enemies.some(e => e.alive && e.type === 'lurker' && e.pos.distanceTo(P.pos) < 9)) { P.brT = 6; audio.sting('breath_hiding', 0.55); } }
  P.recoil *= Math.exp(-dt * 10); P.flinch = Math.max(0, P.flinch - dt * 1.4);
  hero.extras.knife.visible = false; // the shared hand-mounted knife is the visible item
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { const n = Math.min(P.magSize - P.ammo, P.spare); P.ammo += n; P.spare -= n; } }
  if (P.healT > 0) { P.healT -= dt; if (P.healT <= 0) { P.items.kit--; P.hp = Math.min(100, P.hp + 50); toast('Patched up'); showInv(); } }
  if (P.craftT > 0) { P.craftT -= dt; if (P.craftT <= 0) { const r = RECIPES.find(x => x.id === P.craftWhat); if (r?.id === 'repair' && canCraft(r)) { P.items.binding--; P.melee.dur = Math.min(MELEE[P.melee.id].dur, P.melee.dur + 3); audio.sample('belt', null, 0.8); toast('Wrapped and reinforced'); } else if (r && canCraft(r)) { for (const [k, n] of Object.entries(r.need)) P.items[k] -= n; P.items[r.id]++; toast(`Crafted ${NAME[r.id].toLowerCase()}`); if(r.id==='kit' && tutorial?.active && tutorial.steps[tutorial.i][2]==='craft') {if(P.packOpen)ui.closePack();tutorial.signal('craft');} showInv(); if (r.id === 'molotov') P.weapon = 'molotov'; } P.craftWhat = null; hudT = 0; } }
  P.listen = keys.has('KeyQ') && !P.dead && !P.struggle;
  P.aim = (mouseDown[2] || keys.has('KeyZ') || shotPose > 0) && !P.dead && !P.struggle && P.lockT <= 0 && P.healT <= 0 && !P.carry;
  P.aimK = lerp(P.aimK, P.aim ? 1 : 0, Math.min(1, dt * 10));
  // generator: engine keeps pulsing sound events while the shutter rolls up
  if (genT > 0) { genT -= dt; const gc = L.center(L.GENERATOR.x, L.GENERATOR.z); if (Math.floor(genT * 0.66) !== Math.floor((genT + dt) * 0.66)) emitSound(gc.x, gc.z, 18, 'generator', false);
    if (genT < 12.5) { const k = clamp((12.5 - genT) / 3, 0, 1); setShutter(k); if (k >= 0.8 && !L.obstacles.shutterOpen) { L.obstacles.shutterOpen = true; audio.thud(new THREE.Vector3(L.center(L.SHUTTER.x, L.SHUTTER.z).x, 2, L.center(L.SHUTTER.x, L.SHUTTER.z).z)); } } }
  // struggle
  if (P.struggle) {
    const s = P.struggle; s.t -= dt; const e = s.e; P.vel.set(0, 0, 0);
    e.speed = 0; e.yaw = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z); const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1; e.pos.x = P.pos.x + dx / d * 0.7; e.pos.z = P.pos.z + dz / d * 0.7;
    P.yaw = Math.atan2(dx, dz); shake(0.03, 0.1); e.attackT = 0.3;
    if (!e.alive) P.struggle = null;
    else if (s.n >= s.need && P.melee) { P.struggle = null; animOnce('stab', 0.6); later(0.15, () => { audio.swingHit(MELEE[P.melee?.id || 'machete'].kind, e.headPos); fx.blood(e.headPos); e.die(); wear(1); }); }
    else if (s.n >= s.need) { P.struggle = null; e.stagger = 2.2; e.pos.x += dx / d * 1.1; e.pos.z += dz / d * 1.1; audio.stab(e.headPos); e.damage(1, false); animOnce('stab', 0.6); }
    else if (s.t <= 0) { P.struggle = null; P.hp -= 40 * incomingDamage(); audio.hurt(); fx.blood(P.pos.clone().setY(1.3)); shake(0.4, 0.4); e.atkCool = 2.5; e.stagger = 0.9; if (P.hp <= 0) die(e.type); }
  }
  // movement
  const f2 = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)), r2 = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
  const wish = new THREE.Vector3();
  if (!P.packOpen || true) { if (keys.has('KeyW')) wish.add(f2); if (keys.has('KeyS')) wish.sub(f2); if (keys.has('KeyD')) wish.add(r2); if (keys.has('KeyA')) wish.sub(r2); }
  const surf = L.surfaceAt(P.pos.x, P.pos.z); const squeeze = surf === 'n';
  const busy = P.lockT > 0 || !!P.struggle || P.dead || P.pickT > 0;
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const canRun = running && !P.crouch && !P.aim && wish.lengthSq() > 0 && P.stamina > 0.05 && !P.listen && !squeeze && !P.carry;
  if (canRun) P.stamina = Math.max(0, P.stamina - dt * 0.11); else P.stamina = Math.min(1, P.stamina + dt * 0.14);
  const crouching = (P.crouch || squeeze) && !P.carry;
  let top = crouching ? 1.35 : canRun ? 4.6 : P.aim ? 1.6 : 2.4; if (P.listen) top = Math.min(top, 1.2); if (squeeze) top = 0.9; if (P.carry) top = 1.5; if (P.healT > 0 || P.craftT > 0) top = 0.8; if (busy) top = 0;
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(top);
  const accel = canRun ? 5 : 8; P.vel.lerp(wish, Math.min(1, dt * accel));
  if (P.dodgeT > 0) P.vel.copy(P.dodgeDir).multiplyScalar(6.5);
  P.pos.addScaledVector(P.vel, dt); L.collide(P.pos, 0.3);
  P.speed = Math.hypot(P.vel.x, P.vel.z); P.moving = P.speed > 0.25;
  P.crouchK = lerp(P.crouchK, crouching ? 1 : 0, Math.min(1, dt * 8));
  if (P.aimK > 0.4 || P.struggle) { if (!P.struggle) P.yaw += angDiff(P.yaw, camYaw) * Math.min(1, dt * 14); }
  else if (P.speed > 0.3 && P.dodgeT <= 0) P.yaw += angDiff(P.yaw, Math.atan2(P.vel.x, P.vel.z)) * Math.min(1, dt * 9);
  W.playerFacing.set(Math.sin(camYaw), 0, Math.cos(camYaw));
  P.inShadow = !curArea?.outside && !W.flashlightOn;
  // footsteps & surface sound
  P.stepDist += P.speed * dt; stepPhase += P.speed * dt * 2.6; const stride = crouching ? 0.55 : canRun ? 1.15 : 0.75;
  if (P.stepDist >= stride && P.moving) {
    P.stepDist = 0; let mat = surf === 't' ? '.' : surf; 
    const base = crouching ? 1.0 : canRun ? 9 : 3.5; const mul = { c: 0.5, '.': 1, w: 1.2, m: 1.9, g: 2.2, f: 1.6, k: 1, n: 1 }[mat] ?? 1;
    let rr = base * mul; if (mat === 'g') rr = Math.max(rr, 6); if (mat === 'm') rr = Math.max(rr, 2.5); if (P.carry) rr += 1.5;
    audio.step(mat, crouching ? 0.35 : canRun ? 1 : 0.6, P.pos.clone().setY(0.1));
    if (surf === 'P') audio.creak?.(P.pos);
    if (rr > 1.1) emitSound(P.pos.x, P.pos.z, rr, mat === 'f' ? 'fungal' : 'step', true);
    if (mat === 'w') fx.splash(P.pos.clone().setY(0.05));
    if (mat === 'g') fx.emit(P.pos.clone().setY(0.03), 4, { color: [0.8, 1, 0.95], spread: 0.6, up: 0.4, grav: 6, life: 0.3 });
    if (mat === 'f') { fx.spores(P.pos.clone().setY(0.3), crouching ? 3 : 10); vibrate(P.pos, crouching ? 2 : 5); }
    if (mat === 'k' && !flags.crackDone) bigMoment(P.pos.clone());
  }
  if (canRun || P.stamina < 0.35) { P.breathT -= dt; if (P.breathT <= 0 && P.stamina < 0.6) { P.breathT = 0.9 + P.stamina; audio.breath(0.35 * (1 - P.stamina)); } }
  // area changes
  if(tutorial?.active){P.pos.x=clamp(P.pos.x,1,21);P.pos.z=clamp(P.pos.z,1,27);}
  const a = L.areaAt(P.pos.x, P.pos.z); if (!tutorial?.active && a !== curArea) { curArea = a; onEnterArea(a.id); }
  if (flags.escape) { escapeSetpieces(); if (a.id === 'outside' && P.pos.x < 26 && !flags.ending) startEnding(); }
  // corridor dread
  const [pcx, pcz] = L.cellOf(P.pos.x, P.pos.z);
  if (a.id === 'corridor') {
    if (pcx >= 30 && !flags.vent) { flags.vent = true; later(0.4, () => audio.sting('sting_dark_0', 0.7)); const v = new THREE.Vector3(L.center(33, 7).x, 3.8, L.center(33, 7).z); audio.vent(v); fx.dust(v, 20); }
    if (pcx >= 33 && pcz <= 8 && !flags.crawl) { flags.crawl = true; for (let i = 0; i < 4; i++) later(i * 0.7, () => audio.scrape(new THREE.Vector3(L.center(35 + i, 7).x, 3.8, L.center(35, 7).z), 0.8)); }
  }
  for (const c of world.corpses) { c.cool -= dt; if (c.cool <= 0 && c.pos.distanceTo(P.pos) < 3.2) { c.cool = 5; fx.spores(c.pos, 30); fx.emit(c.pos, 12, { color: [0.9, 0.85, 0.7], spread: 0.6, up: 0, grav: 0.6, life: 2 }); } }
  if (a.id === 'apartment') { ambT -= dt; if (ambT <= 0) { ambT = 7 + Math.random() * 7; const lk = enemies.filter(e => e.type === 'lurker' && e.alive); if (lk.length) { const e = lk[(Math.random() * lk.length) | 0]; const roll = Math.random(); const p = e.pos.clone().setY(0.2);
    if (roll < 0.35) { for (let i = 0; i < 3; i++) later(i * 0.35, () => audio.step('c', 0.6, e.pos)); } else if (roll < 0.6) audio.roll(p); else if (roll < 0.85) audio.click(e.headPos, 2, 0.45); else audio.door(p, false); } } }
  P.shield = false; for (const v of world.hangingVines) if (Math.hypot(v.position.x - P.pos.x, v.position.z - P.pos.z) < 0.9 && P.moving) { P.shield = true; if (!v.rustle || W.time - v.rustle > 1.5) { v.rustle = W.time; audio.pickup(); } v.rotation.z = Math.sin(W.time * 8) * 0.2; }
  // enemies
  for (const e of enemies) e.update(dt);
  updateProjectiles(dt); updateFires(dt);
  renderer.domElement.classList.toggle('listen', false);
  for (const e of enemies) {
    const d = e.pos.distanceTo(P.pos); let vis = P.listen && e.alive && d < 16 && e.state !== 'DORMANT';
    if (vis && e.stillT > 1.5 && (e.type === 'lurker' || d > 7)) vis = false;
    const target = vis ? 0.55 * (1 - d / 20) : 0; e.h.silMat.opacity = lerp(e.h.silMat.opacity, target, Math.min(1, dt * 6));
  }
  let I = ['corridor', 'apartment', 'nest', 'escape'].includes(a.id) ? 1 : 0;
  for (const e of enemies) { if (!e.alive || e.state === 'DORMANT') continue; const d = e.pos.distanceTo(P.pos);
    if (e.state === 'COMBAT' && d < 28) I = Math.max(I, 3); else if (['ALERT', 'INVESTIGATE', 'SEARCH', 'SUSPICIOUS', 'WAKING'].includes(e.state) && d < 22) I = Math.max(I, 2); else if (d < 14) I = Math.max(I, 1); }
  if (P.struggle) I = 3; if (flags.escape && !a.outside) I = 4;
  const it = nearbyInteract(); const mt = !P.aim ? meleeTarget() : null;
  const pr = $('prompt'); if (P.struggle) pr.style.opacity = 0; else if (it) { pr.innerHTML = `<b>E</b>${it.label}`; pr.style.opacity = 0.85; } else if (mt && mt.takedown) { pr.innerHTML = `<b>F</b>${mt.e.state === 'DORMANT' ? 'Silence it' : mt.needShiv ? `Shiv takedown (${P.items.shiv})` : 'Takedown'}`; pr.style.opacity = 0.85; } else pr.style.opacity = 0;
  animatePlayer(dt, canRun, crouching);
  updateCamera(dt, canRun, squeeze);
  commonWorld(dt, I);
  updateHUD(dt);
}

function animatePlayer(dt, canRun, crouching) {
  carryMesh.position.copy(P.pos); carryMesh.rotation.y = P.yaw;
  const usable = !P.dead && !P.packOpen && !P.carry && P.craftT <= 0;
  gunMesh.visible = usable && P.healT <= 0 && P.weapon === 'pistol';
  const showMelee = usable && P.healT <= 0 && P.weapon === 'melee';
  for (const [id,m] of Object.entries(meleeModels)) m.visible = !!showMelee && P.melee?.id === id;
  for (const [id,m] of Object.entries(heldItems)) m.visible = usable && (P.healT > 0 ? id === 'kit' : id === 'knife' ? showMelee && !P.melee : id === 'kit' ? false : id === (P.weapon === 'throw' ? throwKind() : P.weapon));
  meleeHolder.visible = usable && !gunMesh.visible;
  if (heroC?.ok) {
    heroC.root.position.copy(P.pos); heroC.root.rotation.y = P.yaw;
    let clip = 'idle', sp = 1, once = false;
    if (P.dead) { clip = 'death'; once = true; }
    else if (P.struggle) clip = 'hit';
    else if (P.anim) { clip = P.anim.name; once = true; }
    else if (P.aimK > 0.5) { clip = 'aim'; sp = P.speed > 0.3 ? P.speed / 1.4 : 0; }
    else if (P.healT > 0 || P.craftT > 0 || P.packOpen) clip = 'crouchidle';
    else if (crouching) { clip = P.speed > 0.2 ? 'crouch' : 'crouchidle'; sp = P.speed > 0.2 ? P.speed / 1.1 : 1; }
    else if (P.speed > 3.1) { clip = 'run'; sp = P.speed / 4.4; }
    else if (P.speed > 0.2) { clip = P.hp < 35 && heroC.has('injured') ? 'injured' : 'walk'; sp = P.speed / 1.35; }
    heroC.play(clip, { once, fade: clip === 'death' ? 0.15 : 0.22 });
    if (!once) { if (clip === 'aim' && sp === 0) { const a = heroC.actions.aim; if (a) { a.time = a.getClip().duration * 0.3; a.timeScale = 0; } } else heroC.speed(clamp(sp, 0.45, 1.7)); }
    heroC.update(dt);
    // Animated rigs can change bone scale. Keep real item dimensions independent of it.
    heroC.root.updateMatrixWorld(true);
    const itemHand = heroC.bones.RightHand;
    if (itemHand) {
      itemHand.getWorldPosition(gunMesh.position);
      gunMesh.quaternion.copy(heroC.root.quaternion);
      gunMesh.rotateX(P.aimK > 0.5 ? -camPitch : 0);
      gunMesh.position.y -= 0.025;
      itemHand.getWorldQuaternion(meleeHolder.quaternion);
      itemHand.getWorldPosition(meleeHolder.position);
    }
    if(P.healT > 0) {
      const k=1-P.healT/2.2, b=heroC.bones.RightHand;
      if(b) b.rotation.z += Math.sin(k*Math.PI*6)*0.16;
      heldItems.kit.rotation.z=Math.sin(k*Math.PI*6)*0.12;
    } else heldItems.kit.rotation.z=0;
    return;
  }
  hero.root.position.copy(P.pos); hero.root.rotation.y = P.yaw;
  const lookRel = clamp(angDiff(P.yaw, camYaw), -1, 1);
  animate(hero, { dt, speed: P.dead ? 0 : P.speed, crouch: P.crouchK, aim: P.aimK, run: canRun ? 1 : 0, recoil: P.recoil, aimPitch: -camPitch * 0.9,
    pose: P.struggle ? 'struggle' : P.strikeT > 0.1 ? 'strike' : P.healT > 0 || P.craftT > 0 ? 'heal' : null, shield: P.shield,
    headYaw: P.aimK > 0.5 ? 0 : lookRel * 0.7 + (P.flinch > 0 ? Math.sin(P.flinch * 5) * 0.5 : 0), headPitch: P.aimK > 0.5 ? 0 : -camPitch * 0.4, tilt: P.flinch * 0.1, lean: P.pickT > 0 ? 0.6 : 0 });
  if (P.dead) hero.body.rotation.x = lerp(hero.body.rotation.x, -1.4, dt * 3); else hero.body.rotation.x *= 0.8;
}

function vibrate(p, r) { for (const t of world.tendrils) if (t.mid.distanceTo(p) < r + 2) t.amp = Math.max(t.amp, 1); }

// Spring-arm third-person camera: smoothed pivot, collision pull-in with slow recovery, aim/sprint FOV.
function updateCamera(dt, running, squeeze) {
  const ch = lerp(1.58, 1.12, P.crouchK);
  const tx = P.pos.x, tz = P.pos.z;
  camPivot.x = damp(camPivot.x, tx, 16, dt); camPivot.z = damp(camPivot.z, tz, 16, dt); camPivot.y = damp(camPivot.y, ch, 7, dt);
  camFwd.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
  const right = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
  const wantDist = squeeze ? 0.95 : P.packOpen ? 1.3 : lerp(P.carry ? 2.4 : 2.05, 0.95, P.aimK) + (running ? 0.25 : 0);
  const side = shoulder * lerp(0.5, 0.45, P.aimK);
  const sideT = L.rayWall(camPivot, right.clone().multiplyScalar(shoulder), Math.abs(side) + 0.2);
  const sp = camPivot.clone().addScaledVector(right, shoulder * Math.max(0, Math.min(Math.abs(side), sideT - 0.2)));
  const back = camFwd.clone().negate();
  let hitD = L.rayWall(sp, back, wantDist + 0.3) - 0.28; // probe a few offset rays so thin edges don't clip
  for (const off of [[0.12, 0], [-0.12, 0], [0, 0.12]]) { const o = sp.clone().addScaledVector(right, off[0]); o.y += off[1]; hitD = Math.min(hitD, L.rayWall(o, back, wantDist + 0.3) - 0.28); }
  const target = Math.max(0.25, Math.min(wantDist, hitD));
  camDist = target < camDist ? target : damp(camDist, target, 4, dt);
  const want = sp.clone().addScaledVector(back, camDist);
  // footfall bob + handheld stress sway
  const moveK = clamp(P.speed / 4.6, 0, 1);
  want.y += Math.sin(stepPhase * 2) * 0.018 * moveK * (1 - P.aimK);
  camera.position.copy(want);
  charLight.position.copy(camera.position).add(new THREE.Vector3(0, 0.4, 0));
  const stress = clamp(audio.intensity - 1.5, 0, 2) * 0.004 + (P.aimK > 0.5 ? 0.0015 : 0);
  if (shakeT > 0) shakeT -= dt; else shakeAmp *= 0.9;
  const t = W.time; const sx = Math.sin(t * 1.3) * stress + Math.sin(t * 31) * shakeAmp * 0.1 * (shakeT > 0 ? 1 : 0), sy = Math.cos(t * 1.7) * stress + Math.cos(t * 27) * shakeAmp * 0.1 * (shakeT > 0 ? 1 : 0);
  camera.lookAt(camera.position.clone().add(camFwd).add(new THREE.Vector3(sx, sy, 0)));
  fovK = damp(fovK, (running ? 1 : 0) - P.aimK * 1.7, 5, dt);
  camera.fov = 58 + fovK * 7; camera.updateProjectionMatrix();
}

function commonWorld(dt, I) {
  flashDir.lerp(camFwd, Math.min(1, dt * 7)).normalize();
  const sh = new THREE.Vector3(P.pos.x, 1.38 - P.crouchK * 0.38, P.pos.z).add(new THREE.Vector3(-Math.cos(P.yaw), 0, Math.sin(P.yaw)).multiplyScalar(-0.14)).addScaledVector(W.playerFacing, 0.2);
  flash.position.copy(sh); flash.target.position.copy(sh).addScaledVector(flashDir, 6);
  const flick = W.flashlightOn ? (Math.random() < 0.004 ? 0.3 : 1) : 0; flash.intensity = lerp(flash.intensity, 75 * flick, Math.min(1, dt * 20));
  fill.position.copy(sh).addScaledVector(flashDir, 1.2); fill.intensity = flash.intensity * 0.012;
  let lightning = 0; thunderT -= dt;
  if (thunderT <= 0) { thunderT = 18 + Math.random() * 20; flags.boltT = 0.35; later(0.6 + Math.random() * 1.5, () => audio.thunder(curArea?.outside ? 1 : 0.55)); }
  if (flags.boltT > 0) { flags.boltT -= dt; lightning = (flags.boltT > 0.2 || (flags.boltT < 0.12 && flags.boltT > 0.05)) ? 1 : 0; }
  applyLook(dt, lightning);
  for (const fl of world.flicker) { const on = Math.sin(W.time * fl.rate * 7) > -0.8 || Math.random() > 0.4; fl.light.intensity = on ? fl.base * (0.85 + Math.random() * 0.15) : 0.2; fl.mesh.material.color.setScalar(on ? 1 : 0.15); }
  const sOn = Math.random() > (Math.sin(W.time * 0.7) > 0.6 ? 0.5 : 0.03); world.sign.light.intensity = sOn ? 6 : 0.3; world.sign.mat.color.setScalar(sOn ? 1 : 0.2);
  world.nestLights.forEach((l, i) => l.intensity = 4.5 + Math.sin(W.time * 0.6 + i * 2) * 1.2);
  for (const l of world.escapeLights) { if (!flags.escape) { l.light.intensity = 0; continue; } if (l.kill > 0) { l.kill -= dt; l.light.intensity = Math.random() < 0.3 ? 8 : 0; } else l.light.intensity = 7 * (0.6 + 0.4 * Math.max(0, Math.sin(W.time * 5))); l.lamp.material.color.setHex(l.light.intensity > 3 ? 0xff3020 : 0x401010); }
  { const on = !!flags.escape; beacon.intensity = on ? 9 * (0.55 + 0.45 * Math.max(0, Math.sin(W.time * 4))) : 0; beaconLamp.material.color.setHex(on && beacon.intensity > 5 ? 0xff3020 : 0x300808);
    const ph = (W.time * 2.4) % (trail.length + 2); trail.forEach((m, i) => m.material.color.setHex(on ? (Math.abs(i - ph) < 0.9 ? 0xff3a22 : 0x4a0c08) : 0x1a0404)); }
  for (const d of L.doors.values()) if (d.open && d.anim < 1 && d.kind !== 'L') { d.anim = Math.min(1, d.anim + dt * 1.6); d.mesh.rotation.y = -1.7 * (1 - Math.pow(1 - d.anim, 3)); }
  for (const t of world.tendrils) { if (t.amp > 0.01) { t.amp *= Math.exp(-dt * 1.5); t.mesh.position.y = Math.sin(W.time * 45 + t.phase) * 0.012 * t.amp; if (Math.random() < t.amp * dt * 4) fx.spores(t.mid, 3); } }
  if (curArea?.outside && Math.random() < 0.8) fx.splash(new THREE.Vector3(P.pos.x + (Math.random() - 0.5) * 10, 0.03, P.pos.z + (Math.random() - 0.5) * 10));
  fx.update(dt, camera.position, (p) => { audio.thud(p); emitSound(p.x, p.z, 10, 'debris', false); });
  const indoor = !curArea?.outside; const [ox] = L.cellOf(P.pos.x, P.pos.z);
  audio.setListener(camera); audio.update(dt, { deep: ({ nest: 1, corridor: 0.45, escape: 0.6, apartment: 0.3 })[curArea?.id] || 0, target: mode === 'ending' ? 0 : I, indoor, listen: P.listen, outsideProx: curArea?.id === 'pharmacy' && ox < 16 ? 1 : 0 });
}

// adaptive quality: drop AO / resolution if the frame rate sags
let perfT = 0, perfN = 0, perfAcc = 0;
function perf(dt) {
  if (mode !== 'play') return; perfAcc += dt; perfN++; perfT += dt;
  if (perfT > 4) { const fps = perfN / perfAcc; perfT = perfAcc = perfN = 0; W.fps = fps; ui.setFPS(settings.fps, fps); if (settings.quality !== 'auto') return;
    if (fps < 38 && gtao.enabled) { gtao.enabled = false; console.info('perf: AO off', fps.toFixed(1)); }
    else if (fps < 32 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); onResize(); console.info('perf: pixelRatio 1'); } }
}
function loop() {
  requestAnimationFrame(loop);
  const raw = Math.min(0.05, clock.getDelta()); const dt = raw * (W.slowT > 0 ? 0.3 : 1); if (W.slowT > 0) W.slowT -= raw;
  if (!paused) { update(dt); perf(dt); }
  audio.updateMenu(raw, mode === 'title' && titleReady);
  composer.render(dt);
}
{ const c = L.center(L.START.x, L.START.z); P.pos.set(c.x, 0, c.z); camPivot.set(c.x, 1.5, c.z); (heroC?.root || hero.root).position.copy(P.pos); (heroC?.root || hero.root).rotation.y = P.yaw; camera.position.set(c.x - 1.8, 1.6, c.z + 0.6); camera.lookAt(c.x + 5, 1.4, c.z); curArea = L.areaAt(c.x, c.z); }
function startPractice() {
  slot=null;restoreSnap(initialSnap,true);mode='play';playT=0;keys.clear();mouseDown=[false,false,false];
  for(const e of enemies)e.dispose();enemies.length=0;
  P.weapon='none';P.ammo=6;P.spare=24;P.items.kit=0;P.items.cloth=0;P.items.alcohol=0;P.items.bottle=2;P.hp=100;
  tutorial.start();$('objective').style.opacity=0;ui.guide(false);fade(0,0.5);relock();
}
tutorial = new PracticeGuide({
 show: data => {
  let box=$('practiceGuide');if(!box){box=document.createElement('div');box.id='practiceGuide';document.body.appendChild(box);}
  box.hidden=!data;
  if(data)box.innerHTML=`<div class="practice-top">LEARN TO SURVIVE <span>${data.index} / ${data.total}</span></div><div class="practice-content"><b class="practice-icon">${data.icon}</b><div><h3>${data.title}</h3><p>${data.body}</p><strong class="practice-keys">${data.keys}</strong></div></div><div class="practice-track"><i style="width:${data.index/data.total*100}%"></i></div><small>T skip to story · practice does not change your saves</small>`;

 },
 spawn: () => { const e=new Enemy({id:'practice-infected',type:'frenzied',x:8,z:7,yaw:-Math.PI/2},W);e.hp=2;e.cfg={...e.cfg,walk:0.6,run:1.1};enemies.push(e);registerEnv(e.h.root);P.ammo=6;P.spare=24; },
 prepareHeal: () => {P.hp=60;P.items.kit=Math.max(1,P.items.kit);toast('Practice injury · H applies antiseptic and a wrap');},
 healed: () => P.hp>=99 && P.healT<=0,
 supplies: () => {
   for(const [kind,dx] of [['cloth',-1],['alcohol',1]]) {
     const id=`practice-${kind}`,g=new THREE.Group();g.position.set(P.pos.x+dx,0,P.pos.z+2);
     const item=buildItem(kind);item.position.y=.4;g.add(item);
     const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.14),new THREE.MeshBasicMaterial({color:0xe7ca86}));marker.position.y=.95;g.add(marker);
     const ring=new THREE.Mesh(new THREE.TorusGeometry(.3,.016,5,24),new THREE.MeshBasicMaterial({color:0xe7ca86}));ring.rotation.x=Math.PI/2;ring.position.y=.035;g.add(ring);
     const [x,z]=L.cellOf(g.position.x,g.position.z);scene.add(g);pickMeshes.set(id,g);L.PICKUPS.push({id,kind,x,z,dyn:true,training:true});
   }
 },
 finish: () => {S.setMeta({practiceSeen:true});onNewGame(true);},
});
const initialSnap = snapshot('start'); initialSnap.enemies = L.ENEMIES.map(d => d.id); initialSnap.hp = 100; initialSnap.yaw = Math.PI / 2; initialSnap.flash = false; initialSnap.map = null; initialSnap.notes = []; initialSnap.stats = { kills: 0, deaths: 0 };
loop();

// ------------------------------------------------------------------ dev hooks + self test
const TP = { nailboard: [9, 9], machete: [32, 7], saber: [50, 3], street: [3, 7], pharmacy: [13, 7], back: [22, 11], plank: [23, 8], pit: [31, 7], corridor: [27, 10], apartment: [39, 10], nest: [39, 21], crack: [46, 21], gen: [57, 25], store: [61, 23], escape: [35, 24], outside: [12, 23] };
window.__game = {
  P, W, gtao, bloom, grade, heroC, gun: () => gunMesh, flags: () => flags, obstacles: L.obstacles, enemies: () => enemies.map(e => ({ id: e.id, type: e.type, state: e.state, alive: e.alive, x: +e.pos.x.toFixed(1), z: +e.pos.z.toFixed(1), rig: !!e.c })),
  teleport(name, yaw) { const [x, z] = TP[name]; const c = L.center(x, z); P.pos.set(c.x, 0, c.z); P.vel.set(0, 0, 0); camPivot.set(c.x, 1.5, c.z); if (yaw !== undefined) { camYaw = yaw; P.yaw = yaw; } },
  look(yaw, pitch = -0.08) { camYaw = yaw; camPitch = pitch; P.yaw = yaw; },
  start() { if (mode === 'title') { audio.init(); titleReady = true; applySettings(settings); ui.hideAll(); $('title').style.display = 'none'; slot = null; startNew(); } },
  ui, settings, snapshot, restoreSnap, stage: () => stageNow().id, progress: progressPct, map: mapApi, openPack, openPause, openMap,
  step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) update(dt); composer.render(dt); return W.time; },
  equip(id) { P.melee = { id, dur: MELEE[id].dur }; }, melee, attackPlayer: (e) => W.onAttack(e),
  emitSound, interact, craft: (i) => startCraft(RECIPES[i]), give(k, n = 1) { P.items[k] = (P.items[k] || 0) + n; },
  openAll() { for (const d of L.doors.values()) { d.open = true; setDoorVisual(d); } },
  kill() { P.hp = 0; die(); }, forceEscape() { startEscape(); }, bigMoment: () => bigMoment(P.pos.clone()), drop: dropToNest, setFlash(v) { W.flashlightOn = v; },
  fire() { P.aim = true; mouseDown[2] = true; fire(); mouseDown[2] = false; }, throwItem, keys,
  selfTest() {
    const res = []; const ok = (name, v) => res.push((v ? 'PASS ' : 'FAIL ') + name);
    const saveOpen = [...L.doors.values()].map(d => [d, d.open]); for (const d of L.doors.values()) d.open = true;
    const so = { ...L.obstacles }; L.obstacles.plankPlaced = true; L.obstacles.shutterOpen = true;
    const c = (n) => L.center(...TP[n]);
    for (const [a, b] of [['street', 'pharmacy'], ['pharmacy', 'corridor'], ['corridor', 'apartment'], ['nest', 'store'], ['store', 'escape'], ['escape', 'outside']]) { const p = L.astar(c(a).x, c(a).z, c(b).x, c(b).z); ok(`path ${a}->${b}`, !!p && p.length > 0); }
    ok('nest not walkable from apartment (drop only)', !L.astar(c('apartment').x, c('apartment').z, c('nest').x, c('nest').z, { avoidHole: true }));
    L.obstacles.plankPlaced = false; ok('pit blocks corridor without plank', !L.astar(c('pharmacy').x, c('pharmacy').z, c('apartment').x, c('apartment').z));
    L.obstacles.shutterOpen = false; ok('shutter blocks storeroom without power', !L.astar(c('nest').x, c('nest').z, c('store').x, c('store').z));
    Object.assign(L.obstacles, so);
    for (const [d, o] of saveOpen) d.open = o;
    ok('LOS blocked by wall', !L.losClear(c('pharmacy').x, c('pharmacy').z, c('corridor').x, c('corridor').z));
    const f1 = L.soundField(L.center(20, 9).x, L.center(20, 9).z, 5); ok('sound blocked by wall', f1[L.idx(22, 9)] === Infinity);
    const f2 = L.soundField(L.center(20, 8).x, L.center(20, 8).z, 5); ok('sound passes through opening', f2[L.idx(22, 8)] < Infinity);
    const a0 = P.ammo; if (a0 > 0) { const fc = P.fireCool, rc = P.reloadT; P.fireCool = 0; P.reloadT = 0; this.fire(); ok('firing consumes ammo', P.ammo === a0 - 1); P.ammo = a0; P.fireCool = fc; P.reloadT = rc; }
    const it0 = { ...P.items }; P.items.cloth = 1; P.items.alcohol = 1; P.craftT = 0; startCraft(RECIPES[1]); update(3); ok('crafting a molotov consumes cloth+alcohol', P.items.molotov === it0.molotov + 1 && P.items.cloth === 0); P.items = it0;
    ok('player uses rigged model', !!heroC?.ok); ok('enemy rig or procedural fallback available', enemies.every(e => e.c?.ok || !!e.h?.root));
    return res;
  },
};
