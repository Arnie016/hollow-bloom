// Infected AI: shared perception/memory state machine with per-type behaviour.
import * as THREE from 'three';
import * as L from './level.js';
import { makeInfected, animate } from './models.js';
import { Character, loaded } from './assets.js';

export const TYPES = {
  frenzied:   { hp: 2, walk: 1.0, run: 4.3, sight: 15, fov: 1.9, hear: 1.0, reach: 1.25, headY: 1.62, grab: 'struggle' },
  knocker:    { hp: 4, walk: 0.75, run: 3.4, sight: 0, fov: 0, hear: 1.4, reach: 1.15, headY: 1.58, grab: 'kill' },
  lurker:     { hp: 2, walk: 1.4, run: 4.7, sight: 18, fov: 2.4, hear: 0.9, reach: 1.2, headY: 1.35, grab: 'struggle' },
  bigknocker: { hp: 9, walk: 0.6, run: 2.4, sight: 0, fov: 0, hear: 1.2, reach: 1.5, headY: 2.1, grab: 'kill' },
};
const CALM = new Set(['PATROL', 'RETURN', 'LOST_TARGET', 'SEARCH', 'SUSPICIOUS', 'INVESTIGATE']);
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Enemy {
  constructor(def, W) {
    this.def = def; this.W = W; this.id = def.id; this.type = def.type; this.cfg = TYPES[def.type];
    const c = L.center(def.x, def.z); this.pos = new THREE.Vector3(c.x, 0, c.z); this.home = this.pos.clone();
    this.yaw = def.yaw || 0; this.hp = this.cfg.hp; this.alive = true;
    this.state = def.state || 'PATROL'; this.stateT = 0; this.path = null; this.pathTarget = null; this.repathT = 0;
    this.lastKnown = null; this.lastHeard = null; this.tSinceDetect = 99; this.see = 0; this.lostT = 0;
    this.searchPts = []; this.waitT = 0; this.atkCool = 1; this.stagger = 0; this.speed = 0; this.vel = new THREE.Vector3();
    this.stillT = 0; this.clickT = rand(0.5, 2); this.vocalT = rand(3, 8); this.stepT = 0; this.headYaw = 0; this.headRoll = 0; this.deadT = 0;
    this.h = makeInfected(this.type);
    const rigId=this.type==='bigknocker'?'knocker':this.type;
    this.c=loaded.chars[rigId]?.clips?.walk?new Character(rigId,{height:this.type==='bigknocker'?2.15:this.cfg.headY+0.15}):null;
    if(this.c?.ok){
      // Keep the original root, perception, hitboxes and listen material. Only
      // replace visible geometry; missing/unanimated assets retain the fallback.
      for(const child of this.h.root.children)child.visible=false;
      this.h.root.add(this.c.root);this.c.addSilhouette(this.h.silMat);
    }
    this.rigAttackT=0;
    this.h.root.position.copy(this.pos); this.h.root.rotation.y = this.yaw; W.scene.add(this.h.root);
    if (this.state === 'DORMANT') { this.h.root.position.y = 0.2; this.h.body.rotation.x = -0.25; }
    this.crossDone = false;
  }
  dispose() { this.W.scene.remove(this.h.root); }
  get headPos() { return new THREE.Vector3(this.pos.x, this.cfg.headY * (this.state === 'DORMANT' ? 0.9 : 1) - (this.type === 'lurker' ? 0 : 0), this.pos.z); }
  setState(s) { if (this.state === s) return; this.state = s; this.stateT = 0; this.path = null; this.waitT = 0; if (s === 'SEARCH') this.searchPts = []; }
  aware() { return this.state === 'COMBAT' || this.state === 'ALERT'; }

  // ---------------------------------------------------------- senses
  hear(ev, d) {
    if (!this.alive) return;
    const strength = 1 - d / ev.r;
    if (this.state === 'DORMANT') { if (ev.kind === 'crack' || ev.kind === 'tear' || ev.kind === 'gun' || strength > 0.55) this.wake(ev); return; }
    if (this.state === 'WAKING' || this.state === 'CROSS') return;
    this.lastHeard = { x: ev.x, z: ev.z }; this.heardT = 0;
    const loud = ev.kind === 'gun' || ev.kind === 'tear' || ev.kind === 'crack';
    if (this.state === 'COMBAT') { if (ev.player) this.lastKnown = { x: ev.x, z: ev.z }; this.lostT = 0; return; }
    const blind = this.cfg.sight === 0;
    if (blind && ev.player && d < 3.2 && ev.kind !== 'throw') { this.engage({ x: ev.x, z: ev.z }); return; }
    if (this.type === 'lurker' && ev.player && ev.kind === 'gun') { this.engage({ x: ev.x, z: ev.z }); return; }
    if (loud || strength > 0.6) { this.target = { x: ev.x, z: ev.z }; this.setState('ALERT'); this.vocal(); return; }
    if (this.type === 'lurker' && (this.state === 'HUNT' || this.state === 'HIDE' || this.state === 'AMBUSH')) { if (ev.player) this.lastKnown = { x: ev.x, z: ev.z }; return; }
    if (this.state === 'INVESTIGATE' || this.state === 'ALERT') { this.target = { x: ev.x, z: ev.z }; this.path = null; return; }
    this.target = { x: ev.x, z: ev.z }; this.setState('SUSPICIOUS');
  }
  wake(ev) { this.state = 'WAKING'; this.stateT = 0; this.lastHeard = ev ? { x: ev.x, z: ev.z } : null; this.W.audio.growl(this.pos, 0.9); this.W.fx.spores(this.pos.clone().setY(1.3), 30); }
  engage(p) { const was = this.state; this.lastKnown = { ...p }; this.tSinceDetect = 0; this.lostT = 0; this.setState('COMBAT'); if (was !== 'COMBAT') { this.vocal(true); this.W.onEngage?.(this); } }
  vocal(big) { const W = this.W; if (this.cfg.sight === 0) W.audio.click(this.headPos, big ? 6 : 3, 1.2); else W.audio.scream(this.headPos, this.type, big ? 1 : 0.6); }

  canSeePlayer() {
    const W = this.W, P = W.player; if (!this.cfg.sight || P.dead) return 0;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    let range = this.cfg.sight * (P.crouch ? 0.55 : 1) * (P.inShadow ? 0.75 : 1) * (W.flashlightOn ? 1.15 : 1);
    if (dist > range) return 0;
    const a = Math.abs(angDiff(this.yaw, Math.atan2(dx, dz)));
    if (a > this.cfg.fov / 2 && dist > 1.8) return 0;
    if (!L.losClear(this.pos.x, this.pos.z, P.pos.x, P.pos.z)) return 0;
    return (1 - dist / range) * (P.moving ? 1.6 : 0.6) * (P.crouch ? 0.6 : 1) + (dist < 3 ? 1.5 : 0);
  }
  observedByPlayer() {
    const W = this.W, P = W.player; const dx = this.pos.x - W.camera.position.x, dz = this.pos.z - W.camera.position.z; const d = Math.hypot(dx, dz);
    if (d > 24) return false; const f = W.camFwd; const dot = (dx * f.x + dz * f.z) / (d * Math.hypot(f.x, f.z) + 1e-6);
    return dot > 0.84 && L.losClear(P.pos.x, P.pos.z, this.pos.x, this.pos.z);
  }

  // ---------------------------------------------------------- movement
  goTo(tx, tz, speed, dt, stopDist = 0.4) {
    this.repathT -= dt;
    if (!this.path || this.repathT <= 0 || !this.pathTarget || Math.hypot(this.pathTarget.x - tx, this.pathTarget.z - tz) > 1.5) {
      this.path = L.astar(this.pos.x, this.pos.z, tx, tz, { avoidHole: true }) || []; this.pathTarget = { x: tx, z: tz }; this.repathT = 0.6 + Math.random() * 0.3;
    }
    while (this.path.length && Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) < (this.path.length === 1 ? stopDist : 0.7)) this.path.shift();
    if (!this.path.length) { this.speed = 0; return true; }
    const n = this.path[0]; const dx = n.x - this.pos.x, dz = n.z - this.pos.z;
    this.turnTo(Math.atan2(dx, dz), dt, speed > 2 ? 9 : 4);
    const facing = Math.cos(angDiff(this.yaw, Math.atan2(dx, dz)));
    const sp = speed * Math.max(0.25, facing); const d = Math.hypot(dx, dz);
    this.pos.x += dx / d * sp * dt; this.pos.z += dz / d * sp * dt; this.speed = sp; return false;
  }
  turnTo(y, dt, rate = 5) { this.yaw += angDiff(this.yaw, y) * Math.min(1, dt * rate); }
  randomNear(cx, cz, rad) {
    for (let i = 0; i < 20; i++) { const x = cx + rand(-rad, rad), z = cz + rand(-rad, rad); const [gx, gz] = L.cellOf(x, z); if (L.walkable(gx, gz) && L.tile(gx, gz) !== 'O' && L.astar(this.pos.x, this.pos.z, x, z)) return { x, z }; }
    return { x: cx, z: cz };
  }
  // search spots: prefer doorways / cells hidden from the search centre / behind objects
  buildSearch(c) {
    const pts = []; const [cx, cz] = L.cellOf(c.x, c.z);
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, z = cz + dz; if (!L.walkable(x, z) || L.tile(x, z) === 'O') continue; const p = L.center(x, z);
      let score = Math.random();
      const door = (L.blocksMove(x - 1, z) && L.blocksMove(x + 1, z)) || (L.blocksMove(x, z - 1) && L.blocksMove(x, z + 1)); if (door) score += 1.2;
      if (!L.losClear(c.x, c.z, p.x, p.z)) score += 0.8;
      let nearObj = 0; for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ('HM'.includes(L.tile(x + ax, z + az))) nearObj = 1; score += nearObj * 0.7;
      score -= Math.hypot(dx, dz) * 0.12; pts.push({ ...p, score });
    }
    pts.sort((a, b) => b.score - a.score); this.searchPts = pts.slice(0, 4);
    if (Math.random() < 0.5) this.searchPts.splice(2, 0, { x: this.home.x, z: this.home.z, score: 0 }); // sometimes double back toward old position
  }

  // ---------------------------------------------------------- update
  update(dt) {
    const W = this.W, P = W.player, cfg = this.cfg;
    if (!this.alive) { this.deadT += dt; const k = Math.min(1, this.deadT * 3); this.h.body.rotation.x = -k * 1.45 * this.fallDir; this.h.root.position.y = 0; this.h.body.position.y = -k * 0.1 * 0; this.updateRig(dt,0); return; }
    this.rigAttackT=Math.max(0,this.rigAttackT-dt);
    this.stateT += dt; this.atkCool -= dt; this.tSinceDetect += dt;
    const before = this.pos.clone();
    let pose = null, run = 0, hunch = this.type === 'lurker' ? 0.7 : this.type === 'knocker' || this.type === 'bigknocker' ? 0.25 : 0.1;
    let headYaw = 0, headRoll = 0, headPitch = 0;
    const dxp = P.pos.x - this.pos.x, dzp = P.pos.z - this.pos.z, distP = Math.hypot(dxp, dzp);

    if (this.stagger > 0) { this.stagger -= dt; this.speed = 0; headRoll = Math.sin(this.stateT * 20) * 0.3; }
    else {
      // sight
      if (cfg.sight && !['DORMANT', 'WAKING', 'CROSS'].includes(this.state)) {
        const s = this.canSeePlayer();
        if (s > 0) { this.see += s * dt * 1.6; this.lastSeenPos = { x: P.pos.x, z: P.pos.z }; } else this.see = Math.max(0, this.see - dt * 0.4);
        if (this.state === 'COMBAT') { if (s > 0) { this.lastKnown = { x: P.pos.x, z: P.pos.z }; this.lostT = 0; this.tSinceDetect = 0; } }
        else if (this.see > 1) { if (this.type !== 'lurker' || this.state !== 'HIDE') this.engage(this.lastSeenPos); }
        else if (this.see > 0.35 && CALM.has(this.state) && this.state !== 'SUSPICIOUS' && this.state !== 'INVESTIGATE' && this.type !== 'lurker') { this.target = this.lastSeenPos; this.setState('SUSPICIOUS'); }
      }
      // blind types: touch sense + slow creep awareness when very close and player moving upright
      if (!cfg.sight && !['DORMANT', 'WAKING'].includes(this.state) && distP < 1.4 && P.moving && !P.crouch) this.engage({ x: P.pos.x, z: P.pos.z });
      if (this.state === 'COMBAT' && !cfg.sight) { this.lostT += dt; if (distP < 2.2 && (P.moving && !P.crouch || P.speed > 2)) { this.lastKnown = { x: P.pos.x, z: P.pos.z }; this.lostT = 0; } }
      this.think(dt, distP);
      if (this.state === 'COMBAT' || this.state === 'ALERT') { run = 1; pose = distP < 3 && this.state === 'COMBAT' ? 'reach' : null; }
      if (this.state === 'SUSPICIOUS' || this.state === 'SEARCH' || this.state === 'LISTEN') { headYaw = Math.sin(this.stateT * 1.3) * 0.6; }
      if (!cfg.sight) { // unnatural fungal head motion when listening
        const lis = this.state === 'LISTEN' || this.state === 'SUSPICIOUS' || this.state === 'INVESTIGATE' || this.state === 'SEARCH';
        headRoll = (lis ? 0.5 : 0.15) * Math.sin(this.stateT * 2.1 + Math.sin(this.stateT * 7) * 0.8); headYaw += (lis ? 0.35 : 0.1) * Math.sin(this.stateT * 0.9 + 1); headPitch = lis ? -0.3 : 0;
        this.clickT -= dt; const rate = this.state === 'COMBAT' ? 0.35 : lis ? 0.9 : 2.2;
        if (this.clickT <= 0 && this.state !== 'DORMANT') { this.clickT = rate * rand(0.7, 1.3); W.audio.click(this.headPos, this.state === 'COMBAT' ? 4 : 2 + (Math.random() * 2 | 0), this.type === 'bigknocker' ? 1.3 : 0.9); }
      } else if (this.type === 'frenzied' && this.state !== 'DORMANT') { // twitches / hesitations
        if (Math.random() < dt * 0.4) this.twitch = 0.4; if (this.twitch > 0) { this.twitch -= dt; headRoll = Math.sin(this.twitch * 40) * 0.4; this.speed *= 0.3; }
        this.vocalT -= dt; if (this.vocalT <= 0) { this.vocalT = this.state === 'COMBAT' ? rand(1.5, 3) : rand(6, 12); W.audio.growl(this.headPos, this.state === 'COMBAT' ? 0.8 : 0.35); }
      }
    }
    // separation + walls
    for (const o of W.enemies) if (o !== this && o.alive) { const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-4) { this.pos.x += dx / d * (0.7 - d) * 0.5; this.pos.z += dz / d * (0.7 - d) * 0.5; } }
    if (this.state !== 'DORMANT') L.collide(this.pos, 0.3);
    const moved = this.pos.distanceTo(before); this.stillT = moved < 0.004 ? this.stillT + dt : 0;
    // audible footsteps (not sound events: info for the player only)
    this.stepT -= moved; if (this.stepT <= 0 && moved > 0) { this.stepT = 0.8; W.audio.step(L.surfaceAt(this.pos.x, this.pos.z), this.type === 'lurker' ? 0.35 : run ? 0.8 : 0.4, this.pos); if (Math.random() < 0.08) W.fx.nudgeProp?.(this.pos); }
    // pose
    const r = this.h.root; r.position.x = this.pos.x; r.position.z = this.pos.z; r.rotation.y = this.yaw;
    if (this.state === 'DORMANT') { headRoll = Math.sin(W.time * 0.5 + this.pos.x) * 0.05; }
    if (this.state === 'WAKING') { const k = Math.min(1, this.stateT / 2.2); r.position.y = 0.2 * (1 - k); this.h.body.rotation.x = -0.25 * (1 - k) + Math.sin(this.stateT * 18) * 0.05 * (1 - k); pose = 'reach'; }
    else if (this.state !== 'DORMANT') { r.position.y = 0; this.h.body.rotation.x *= 0.9; }
    animate(this.h, { dt, speed: this.speed, crouch: this.type === 'lurker' && this.state !== 'COMBAT' ? 0.35 : 0, run, hunch, pose, headYaw, headRoll, headPitch, lean: this.stagger > 0 ? -0.4 : 0 });
    this.updateRig(dt,moved/Math.max(dt,0.001));
    if (this.h.extras.plates) this.h.extras.plates.rotation.z = Math.sin(W.time * 3 + this.pos.x) * 0.08;
  }

  updateRig(dt,actualSpeed){
    if(!this.c?.ok)return;
    let clip='idle',once=false,speed=1;
    if(!this.alive){clip='death';once=true;}
    else if(this.rigAttackT>0){clip='attack';once=true;}
    else if(this.state==='WAKING'&&this.c.has('scream')){clip='scream';once=true;}
    else if(actualSpeed>0.08){clip=actualSpeed>this.cfg.walk*1.5&&this.c.has('run')?'run':'walk';speed=Math.max(0.4,Math.min(1.8,actualSpeed/(clip==='run'?this.cfg.run:this.cfg.walk)));}
    this.c.play(clip,{once,fade:clip==='death'?0.12:0.2,speed});
    this.c.update(dt);
  }

  think(dt, distP) {
    const W = this.W, P = W.player, cfg = this.cfg;
    switch (this.state) {
      case 'DORMANT': this.speed = 0; break;
      case 'WAKING': this.speed = 0; if (this.stateT > 2.2) { this.target = this.lastHeard || { x: P.pos.x, z: P.pos.z }; this.setState('INVESTIGATE'); this.vocal(); } break;
      case 'PATROL': {
        if (this.waitT > 0) { this.waitT -= dt; this.speed = 0; break; }
        if (!this.patrolPt) this.patrolPt = this.randomNear(this.home.x, this.home.z, this.type === 'bigknocker' ? 3 : 6);
        if (this.goTo(this.patrolPt.x, this.patrolPt.z, cfg.walk * 0.8, dt)) { this.patrolPt = null; this.waitT = rand(2, 5); }
        break;
      }
      case 'SUSPICIOUS': { // stop, orient toward stimulus
        this.speed = 0; if (this.target) this.turnTo(Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z), dt, 3);
        if (this.stateT > (cfg.sight ? 1.4 : 2.2)) this.setState('INVESTIGATE'); break;
      }
      case 'INVESTIGATE': case 'ALERT': {
        const t = this.target || this.lastHeard; if (!t) { this.setState('RETURN'); break; }
        const sp = this.state === 'ALERT' ? (cfg.sight ? cfg.run * 0.7 : cfg.walk * 1.8) : cfg.walk * 1.2;
        if (this.goTo(t.x, t.z, sp, dt, 0.8) || this.stateT > 20) { this.searchCenter = { ...t }; this.setState('SEARCH'); }
        break;
      }
      case 'SEARCH': {
        if (!this.searchPts.length && this.stateT < 1) this.buildSearch(this.searchCenter || this.pos);
        if (this.stateT > 16 || !this.searchPts.length) { this.setState('LOST_TARGET'); break; }
        if (this.waitT > 0) { this.waitT -= dt; this.speed = 0; this.yaw += Math.sin(this.stateT * 2) * dt * 1.5; break; }
        const p = this.searchPts[0]; if (this.goTo(p.x, p.z, cfg.walk * 1.1, dt, 0.6)) { this.searchPts.shift(); this.waitT = rand(1, 2.2); }
        break;
      }
      case 'LOST_TARGET': this.speed = 0; if (this.stateT > 2.5) { if (cfg.sight) W.audio.growl(this.headPos, 0.4); this.setState(this.type === 'lurker' ? 'HUNT' : 'RETURN'); } break;
      case 'RETURN': if (this.goTo(this.home.x, this.home.z, cfg.walk, dt, 0.8)) this.setState('PATROL'); break;
      case 'COMBAT': {
        if (P.dead) { this.setState('LOST_TARGET'); break; }
        const lk = this.lastKnown || { x: P.pos.x, z: P.pos.z };
        const knows = cfg.sight ? this.lostT < 0.1 : this.lostT < 2.5;
        if (cfg.sight && this.canSeePlayer() <= 0) this.lostT += dt;
        if (knows && distP < cfg.reach + 0.2 && Math.abs(P.pos.y) < 1) { this.speed = 0; this.turnTo(Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), dt, 10); if (this.atkCool <= 0) { this.atkCool = 2.2; this.rigAttackT=0.8; this.c?.play('attack',{once:true,fade:0.08,restart:true}); W.onAttack(this); } break; }
        const tgt = knows && cfg.sight ? P.pos : lk;
        const arrived = this.goTo(tgt.x, tgt.z, cfg.run, dt, 0.5);
        if ((cfg.sight && this.lostT > 2.5) || (!cfg.sight && this.lostT > 4) || (arrived && !knows)) { this.searchCenter = { ...lk }; this.setState('SEARCH'); }
        break;
      }
      // ---- lurker-specific
      case 'CROSS': { // scripted: dart across an opening once the player arrives, then vanish into the rooms
        if (!W.flags.aptEntered) { this.speed = 0; break; }
        if (!this.crossStarted) { this.crossStarted = true; this.stateT = 0; }
        if (this.stateT < 1.6) { this.speed = 0; break; }
        const t = L.center(45, 13); if (this.goTo(t.x, t.z, cfg.run * 0.9, dt, 0.6)) { this.setState('HIDE'); this.hideUntil = 15; }
        break;
      }
      case 'AMBUSH': { // wait deep inside until the player passes close and looks away
        this.speed = 0; this.turnTo(Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z), dt, 1.5);
        const obs = this.observedByPlayer();
        if (obs && distP < 16) { this.setState('HIDE'); break; }
        if (distP < 5.5 && !obs && L.losClear(this.pos.x, this.pos.z, P.pos.x, P.pos.z)) this.setState('HUNT');
        if (distP < 2.4) this.engage({ x: P.pos.x, z: P.pos.z });
        break;
      }
      case 'HIDE': {
        if (!this.hidePt || this.stateT < dt * 1.5) this.hidePt = this.findHide();
        const done = this.goTo(this.hidePt.x, this.hidePt.z, cfg.run * 0.8, dt, 0.5);
        if (done) { this.speed = 0; if (Math.random() < dt * 0.3) W.audio.click(this.headPos, 2, 0.35); }
        if (this.stateT > (this.hideUntil || rand(3, 6)) && !this.observedByPlayer()) { this.hideUntil = 0; this.setState('HUNT'); }
        break;
      }
      case 'HUNT': { // circle toward the player's back, retreat when watched
        if (this.observedByPlayer() && distP > 2.5) { this.setState('HIDE'); this.hideUntil = rand(2.5, 5); break; }
        const f = W.playerFacing; const bx = P.pos.x - f.x * 2.2, bz = P.pos.z - f.z * 2.2;
        const pdot = (-dxDir(this, P) * f.x + -dzDir(this, P) * f.z); // >0 means lurker is in front of player
        const behind = pdot < 0.2;
        if (distP < 2.3 && behind) { this.engage({ x: P.pos.x, z: P.pos.z }); break; }
        const tgt = distP < 6 ? { x: bx, z: bz } : P.pos;
        this.goTo(tgt.x, tgt.z, distP < 7 ? cfg.walk * 1.2 : cfg.walk * 1.6, dt, 0.6);
        if (this.stateT > 25) this.setState('HIDE');
        break;
      }
    }
  }
  findHide() {
    const W = this.W, P = W.player; const [cx, cz] = L.cellOf(this.pos.x, this.pos.z); let best = null, bs = -1e9;
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      const x = cx + dx, z = cz + dz; if (!L.walkable(x, z) || L.tile(x, z) === 'O') continue; const p = L.center(x, z);
      if (L.areaAt(p.x, p.z).id !== L.areaAt(this.pos.x, this.pos.z).id) continue;
      if (L.losClear(P.pos.x, P.pos.z, p.x, p.z)) continue;
      const dP = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); const s = -Math.hypot(dx, dz) * 1.0 + Math.min(dP, 10) * 0.4 + Math.random();
      if (s > bs) { bs = s; best = p; }
    }
    return best || this.home;
  }
  damage(n, head) {
    if (!this.alive) return;
    this.hp -= head ? (this.type === 'bigknocker' ? 4 : 99) : n;
    if (this.hp <= 0) return this.die();
    this.stagger = head ? 0.8 : 0.45; if (this.state !== 'COMBAT') this.engage({ x: this.W.player.pos.x, z: this.W.player.pos.z });
  }
  die() { this.alive = false; this.state = 'DEAD'; this.fallDir = Math.random() < 0.5 ? 1 : -1; this.speed = 0; this.h.silMat.opacity = 0; this.W.onEnemyDeath?.(this); }
}
function dxDir(e, P) { const d = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) + 1e-6; return (P.pos.x - e.pos.x) / d; }
function dzDir(e, P) { const d = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) + 1e-6; return (P.pos.z - e.pos.z) / d; }
