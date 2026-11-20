import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GUNS, ATTACHMENTS, LOADOUTS, MOUNT, GRENADES, PLAYER, SPAWNS, ELEVATOR } from './data.js';
import { Sound } from './audio.js';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------
const DEG = Math.PI / 180;
const GRAVITY = 18;
const GRENADE_GRAVITY = 9.81;
const STEPS = 4;
const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
// Unity (left-handed) -> web (right-handed, z flipped)
const uPos = (a) => new THREE.Vector3(a[0], a[1], -a[2]);
const uRot = (a) => new THREE.Euler(-a[0] * DEG, -a[1] * DEG, a[2] * DEG, 'YXZ');

const BOT_NAMES = ['Viper', 'Ghost', 'Maverick', 'Nova', 'Raptor', 'Echo', 'Blaze', 'Shadow', 'Kestrel', 'Onyx', 'Havoc', 'Rook', 'Sable', 'Jinx', 'Titan'];
const BOT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xf1c40f, 0xec407a, 0x795548, 0x607d8b, 0x00bcd4, 0x8bc34a, 0xff5722, 0x3f51b5, 0xcddc39];
const DIFFICULTY = {
  easy:   { react: 0.75, error: 4.0, turn: 160, fireGap: 1.6, see: 40, spreadMult: 1.6 },
  normal: { react: 0.45, error: 2.2, turn: 280, fireGap: 1.15, see: 55, spreadMult: 1.15 },
  hard:   { react: 0.22, error: 1.1, turn: 480, fireGap: 1.0, see: 70, spreadMult: 0.85 },
};

// ---------------------------------------------------------------------------
// Settings (persisted)
// ---------------------------------------------------------------------------
const settings = Object.assign({
  name: 'Player', bots: 5, difficulty: 'normal', scoreLimit: 20, timeLimit: 10,
  sensitivity: 1.0, fov: 75, volume: 0.7, loadout: 1, regen: true,
  attachments: {}, // gunKey -> {optic, laser, grip}
}, JSON.parse(localStorage.getItem('fpsgame.settings') || '{}'));
const saveSettings = () => localStorage.setItem('fpsgame.settings', JSON.stringify(settings));
for (const k of Object.keys(GUNS)) {
  settings.attachments[k] = Object.assign({ optic: GUNS[k].Optics[0], laser: GUNS[k].Lasers[0], grip: GUNS[k].Grips[0] }, settings.attachments[k] || {});
  const a = settings.attachments[k];
  if (!GUNS[k].Optics.includes(a.optic)) a.optic = GUNS[k].Optics[0];
  if (!GUNS[k].Lasers.includes(a.laser)) a.laser = GUNS[k].Lasers[0];
  if (!GUNS[k].Grips.includes(a.grip)) a.grip = GUNS[k].Grips[0];
}

// ---------------------------------------------------------------------------
// Renderer / scenes
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4e8);
scene.fog = new THREE.Fog(0x9cc4e8, 60, 180);
const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 400);
scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 1.5));
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(0.4, 1, 0.25); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-0.5, 0.3, -0.8); scene.add(fill);

// Viewmodel (gun in hands) rendered in its own pass so it never clips into walls.
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 20);
vmScene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2.0));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.4); vmSun.position.set(0.5, 1, 0.6); vmScene.add(vmSun);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = vmCamera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix(); vmCamera.updateProjectionMatrix();
});

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------
const loader = new GLTFLoader();
const models = {};
const sound = new Sound();
sound.setVolume(settings.volume);
let worldOctree, nav, mapRoot, elevatorMesh;

async function loadAll() {
  const list = ['map', 'elevator', 'gun_ak12', 'gun_m107', 'gun_g17', 'gun_p90', 'att_grip_hs', 'att_grip_hl', 'att_grip_v', 'att_mount', 'att_laser', 'att_reddot', 'att_holo', 'att_scope', 'gren_explosive', 'gren_flash', 'gren_sticky'];
  let done = 0; const total = list.length + 2;
  const tick = () => { $('loadbar').style.width = `${(++done / total) * 100}%`; };
  await Promise.all(list.map((n) => new Promise((res, rej) => loader.load(`assets/${n}.glb`, (g) => {
    g.scene.traverse((o) => {
      if (o.isMesh) {
        o.material.side = THREE.FrontSide;
        if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
        if (o.material.transparent) { o.material.depthWrite = false; o.renderOrder = 2; }
      }
    });
    models[n] = g.scene; tick(); res();
  }, undefined, rej))));
  nav = await (await fetch('assets/nav.json')).json(); tick();
  await sound.load('assets/audio'); tick();

  mapRoot = models.map;
  scene.add(mapRoot);
  worldOctree = new Octree();
  worldOctree.fromGraphNode(mapRoot);
  elevatorMesh = models.elevator;
  scene.add(elevatorMesh);
  buildNav();
}

// ---------------------------------------------------------------------------
// Navigation graph (precomputed from the map) + A*
// ---------------------------------------------------------------------------
let navGrid;
function buildNav() {
  nav.pos = nav.n.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  navGrid = new Map();
  nav.pos.forEach((p, i) => {
    const k = `${Math.floor(p.x / 2)},${Math.floor(p.z / 2)}`;
    if (!navGrid.has(k)) navGrid.set(k, []);
    navGrid.get(k).push(i);
  });
}
function nearestNode(p) {
  let best = -1, bd = Infinity;
  const cx = Math.floor(p.x / 2), cz = Math.floor(p.z / 2);
  for (let r = 0; r <= 3 && best < 0; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const l = navGrid.get(`${cx + dx},${cz + dz}`); if (!l) continue;
      for (const i of l) {
        const q = nav.pos[i];
        const dy = Math.abs(q.y - p.y);
        if (dy > 1.6) continue;
        const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2 + dy * dy * 4;
        if (d < bd) { bd = d; best = i; }
      }
    }
  }
  return best;
}
function astar(start, goal) {
  if (start < 0 || goal < 0) return null;
  const N = nav.pos.length;
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [[0, start]]; g[start] = 0;
  const P = nav.pos, goalP = P[goal];
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  let iter = 0;
  while (heap.length && iter++ < 20000) {
    const [, u] = pop();
    if (closed[u]) continue; closed[u] = 1;
    if (u === goal) break;
    for (const v of nav.a[u]) {
      if (closed[v]) continue;
      const c = g[u] + P[u].distanceTo(P[v]) * (1 + nav.w[v] * 3);
      if (c < g[v]) { g[v] = c; from[v] = u; push([c + P[v].distanceTo(goalP), v]); }
    }
  }
  if (from[goal] < 0 && goal !== start) return null;
  const path = []; for (let u = goal; u >= 0; u = from[u]) { path.push(u); if (u === start) break; }
  return path.reverse();
}

// ---------------------------------------------------------------------------
// Gun building (model + attachments) used by viewmodel and bots
// ---------------------------------------------------------------------------
function buildGun(gunKey, att) {
  const gd = GUNS[gunKey];
  const root = new THREE.Group();
  root.add(models[gd.model].clone());
  const info = { reticle: null, laser: null, optic: null, scope: false, aimMult: 0.25, aimFovMult: 0.85, preferredDist: 0, gripRecoil: 1, laserColor: null, laserRange: 10, barrel: v3(gd.points.Barrel) };
  const optic = ATTACHMENTS[att.optic], laser = ATTACHMENTS[att.laser], grip = ATTACHMENTS[att.grip];
  info.aimMult = optic.aimMult; info.aimFovMult = optic.aimFovMult;
  if (optic.model) {
    let base = v3(gd.points.OpticAttachmentPoint);
    if (gd.useMount) {
      const m = models.att_mount.clone();
      m.position.copy(base).sub(v3(MOUNT.gunPoint)).add(new THREE.Vector3(0, 0.0431, 0));
      root.add(m);
      base = m.position.clone().add(v3(MOUNT.opticPoint));
    }
    const o = models[optic.model].clone();
    o.position.copy(base).sub(v3(optic.point));
    root.add(o);
    info.reticle = o.position.clone().add(v3(optic.reticle || [0, 0, 0]));
    info.preferredDist = optic.preferredDist; info.scope = optic.hasScope; info.scopeFov = optic.scopeFov;
    info.optic = optic;
    if (optic.reticle && !optic.hasScope) {
      // glowing red dot / holo reticle
      const dot = new THREE.Mesh(new THREE.CircleGeometry(optic.model === 'att_holo' ? 0.0022 : 0.0016, 16), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
      dot.position.copy(info.reticle); dot.rotation.y = Math.PI; dot.position.z -= 0.004;
      root.add(dot);
      if (optic.model === 'att_holo') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.0055, 0.0065, 32), dot.material);
        ring.position.copy(dot.position); ring.rotation.y = Math.PI; root.add(ring);
      }
    }
  }
  if (laser.model && gd.points.LaserAttachmentPoint) {
    const l = models[laser.model].clone();
    l.position.copy(v3(gd.points.LaserAttachmentPoint)).sub(v3(laser.point));
    root.add(l);
    info.laser = l.position.clone().add(v3(laser.laserOrigin || [0, 0, 0]));
    info.laserColor = new THREE.Color(...laser.laserColor);
    info.laserRange = laser.laserRange;
  }
  if (grip.model && gd.points.GripAttachmentPoint) {
    const gm = models[grip.model].clone();
    gm.position.copy(v3(gd.points.GripAttachmentPoint)).sub(v3(grip.point));
    root.add(gm);
    info.gripRecoil = grip.gripRecoil;
  }
  return { root, info };
}

// ---------------------------------------------------------------------------
// Combatants (player + bots)
// ---------------------------------------------------------------------------
const combatants = [];
let player = null;

class Weapon {
  constructor(gunKey, att) {
    this.key = gunKey; this.d = GUNS[gunKey]; this.att = att;
    this.ammo = this.d.MaxAmmo; this.stored = this.d.MaxStoredAmmo;
    this.spread = 0; this.nextFire = 0; this.reloadingUntil = 0; this.reloadStart = 0;
    const b = buildGun(gunKey, att);
    this.info = b.info;
  }
  get reloading() { return game.time < this.reloadingUntil; }
}

class Combatant {
  constructor(name, isBot, color) {
    this.name = name; this.isBot = isBot; this.color = color;
    this.kills = 0; this.deaths = 0;
    this.capsule = new Capsule(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), PLAYER.radius);
    this.velocity = new THREE.Vector3();
    this.onFloor = false; this.yaw = 0; this.pitch = 0;
    this.health = PLAYER.maxHealth; this.dead = true; this.respawnAt = 0;
    this.stance = 'stand'; this.height = PLAYER.height; this.viewHeight = PLAYER.height * 0.75;
    this.invincibleUntil = 0; this.lastHurt = -99; this.blindUntil = 0;
    this.weapons = []; this.wi = 0; this.grenades = 0; this.loadout = null;
    this.stepAcc = 0; this.wasOnFloor = true; this.fallSpeed = 0; this.recoil = new THREE.Vector2();
  }
  get feet() { return new THREE.Vector3(this.capsule.start.x, this.capsule.start.y - this.capsule.radius, this.capsule.start.z); }
  get eye() { return new THREE.Vector3(this.capsule.start.x, this.capsule.start.y - this.capsule.radius + this.viewHeight, this.capsule.start.z); }
  get chest() { return new THREE.Vector3(this.capsule.start.x, this.capsule.start.y - this.capsule.radius + this.height * 0.62, this.capsule.start.z); }
  get weapon() { return this.weapons[this.wi]; }
  get invincible() { return game.time < this.invincibleUntil; }
  setLoadout(idx) {
    const L = LOADOUTS[idx]; this.loadout = L; this.loadoutIdx = idx;
    const attFor = (k) => this.isBot ? randomAttachments(k) : { ...settings.attachments[k] };
    this.weapons = [new Weapon(L.primary, attFor(L.primary)), new Weapon(L.secondary, attFor(L.secondary))];
    this.wi = 0; this.grenades = L.grenadeCount; this.grenadeType = L.grenade;
  }
  placeAt(feet) {
    this.capsule.start.set(feet.x, feet.y + PLAYER.radius + 0.02, feet.z);
    this.setStance('stand', true);
    this.velocity.set(0, 0, 0);
  }
  setStance(s, force = false) {
    const h = s === 'stand' ? PLAYER.height : s === 'crouch' ? PLAYER.crouchHeight : PLAYER.proneHeight;
    const oldEnd = this.capsule.end.clone(), oldH = this.height;
    this.capsule.end.set(this.capsule.start.x, this.capsule.start.y + h - 2 * PLAYER.radius, this.capsule.start.z);
    if (!force && h > oldH) {
      const r = worldOctree.capsuleIntersect(this.capsule);
      if (r && r.normal.y < -0.2) { this.capsule.end.copy(oldEnd); return false; }
    }
    this.stance = s; this.height = h;
    if (force) this.viewHeight = h * 0.75;
    return true;
  }
}

function randomAttachments(k) {
  const g = GUNS[k];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return { optic: k === 'BT .50 Cal' ? 'SniperScope' : pick(g.Optics.filter((o) => o !== 'SniperScope')), laser: pick(g.Lasers), grip: pick(g.Grips) };
}

// ---------------------------------------------------------------------------
// Physics: capsule movement against the map octree + moving elevator platform
// ---------------------------------------------------------------------------
const elevator = { y: ELEVATOR.bottom, state: 'idle', at: 'bottom', t: 0, from: 0, to: 0, waitUntil: 0, vy: 0 };
function elevatorTop() { return elevator.y; }
function inElevatorXZ(p, pad = 0) {
  return Math.abs(p.x - ELEVATOR.x) < ELEVATOR.halfX + pad && Math.abs(p.z - ELEVATOR.z) < ELEVATOR.halfZ + pad;
}
function updateElevator(dt) {
  // Called by anyone standing in the shaft: go to the other floor, or come to them.
  const riders = combatants.filter((c) => !c.dead && inElevatorXZ(c.feet, -0.2));
  if (elevator.state === 'idle') {
    for (const c of riders) {
      const f = c.feet.y;
      const onPlat = Math.abs(f - elevator.y) < 0.3;
      if (onPlat || Math.abs(f - (elevator.at === 'bottom' ? ELEVATOR.top : ELEVATOR.bottom)) < 1.5) {
        elevator.state = 'waiting'; elevator.waitUntil = game.time + ELEVATOR.wait; break;
      }
    }
  } else if (elevator.state === 'waiting' && game.time >= elevator.waitUntil) {
    elevator.state = 'moving'; elevator.t = 0; elevator.from = elevator.y;
    elevator.to = elevator.at === 'bottom' ? ELEVATOR.top : ELEVATOR.bottom;
  } else if (elevator.state === 'moving') {
    elevator.t += dt / ELEVATOR.travel;
    const k = Math.min(1, elevator.t), e = k * k * (3 - 2 * k);
    const ny = elevator.from + (elevator.to - elevator.from) * e;
    elevator.vy = (ny - elevator.y) / Math.max(dt, 1e-4);
    elevator.y = ny;
    if (k >= 1) { elevator.state = 'cooldown'; elevator.at = elevator.at === 'bottom' ? 'top' : 'bottom'; elevator.waitUntil = game.time + 1.5; elevator.vy = 0; }
  } else if (elevator.state === 'cooldown' && game.time >= elevator.waitUntil) {
    const stillOn = riders.some((c) => Math.abs(c.feet.y - elevator.y) < 0.3);
    if (!stillOn) elevator.state = 'idle';
  }
  elevatorMesh.position.set(ELEVATOR.x, elevator.y - ELEVATOR.platformTopLocal, ELEVATOR.z);
}

function moveCombatant(c, wish, dt, { sprint = false, jump = false } = {}) {
  const L = c.loadout || LOADOUTS[1];
  let accel = c.stance === 'prone' ? PLAYER.proneAccel : c.stance === 'crouch' ? PLAYER.crouchAccel : sprint ? PLAYER.sprintAccel : PLAYER.walkAccel;
  accel *= L.speedMult;
  const control = c.onFloor ? 1 : 0.35;
  c.velocity.x += wish.x * accel * control * dt;
  c.velocity.z += wish.z * accel * control * dt;
  const dragK = PLAYER.drag * control;
  c.velocity.x *= Math.exp(-dragK * dt);
  c.velocity.z *= Math.exp(-dragK * dt);
  if (jump && c.onFloor) {
    if (c.stance !== 'stand') { c.setStance(c.stance === 'prone' ? 'crouch' : 'stand'); }
    else { c.velocity.y = PLAYER.jumpForce * L.jumpMult; c.onFloor = false; }
  }
  const wasOnFloor = c.onFloor;
  const sub = dt / STEPS;
  let grounded = false;
  for (let s = 0; s < STEPS; s++) {
    c.velocity.y -= GRAVITY * sub;
    c.capsule.translate(c.velocity.clone().multiplyScalar(sub));
    for (let it = 0; it < 2; it++) {
      const r = worldOctree.capsuleIntersect(c.capsule);
      if (!r) break;
      if (r.normal.y > 0.5) { grounded = true; if (c.velocity.y < 0) c.velocity.y = 0; }
      else { const vn = r.normal.dot(c.velocity); if (vn < 0) c.velocity.addScaledVector(r.normal, -vn); }
      if (r.depth >= 1e-10) c.capsule.translate(r.normal.multiplyScalar(r.depth));
    }
    // elevator platform
    const f = c.capsule.start.y - c.capsule.radius;
    if (inElevatorXZ(c.capsule.start, c.capsule.radius * 0.6)) {
      const top = elevatorTop();
      if (f < top + 0.05 && f > top - 3.0 && c.velocity.y <= elevator.vy + 0.5) {
        c.capsule.translate(new THREE.Vector3(0, top - f, 0));
        grounded = true; c.velocity.y = Math.max(0, elevator.vy);
      }
    }
  }
  c.onFloor = grounded;
  // gentle snap to ground when walking down slopes
  if (wasOnFloor && !c.onFloor && c.velocity.y <= 0) {
    const test = c.capsule.clone(); test.translate(new THREE.Vector3(0, -0.25, 0));
    const r = worldOctree.capsuleIntersect(test);
    if (r && r.normal.y > 0.5) { c.capsule.copy(test); c.capsule.translate(r.normal.multiplyScalar(r.depth)); c.onFloor = true; c.velocity.y = 0; }
  }
  // combatant separation
  for (const o of combatants) {
    if (o === c || o.dead) continue;
    const dx = c.capsule.start.x - o.capsule.start.x, dz = c.capsule.start.z - o.capsule.start.z;
    const dy = Math.abs(c.capsule.start.y - o.capsule.start.y);
    const d = Math.hypot(dx, dz), min = PLAYER.radius * 2;
    if (d < min && d > 1e-4 && dy < 1.5) { const push = (min - d) * 0.5; c.capsule.translate(new THREE.Vector3(dx / d * push, 0, dz / d * push)); }
  }
  c.viewHeight = damp(c.viewHeight, c.height * 0.75, 12, dt);
  // footsteps & landing
  const hs = Math.hypot(c.velocity.x, c.velocity.z);
  if (c.onFloor && hs > 0.5) {
    c.stepAcc += hs * dt;
    if (c.stepAcc > (sprint ? 2.2 : 1.8)) { c.stepAcc = 0; sfx('footstep', c, { volume: c.stance === 'stand' ? (sprint ? 0.55 : 0.35) : 0.15, rate: rand(0.9, 1.1), maxDist: 25 }); }
  }
  if (c.onFloor && !c.wasOnFloor && c.fallSpeed > 4) sfx('footstep', c, { volume: clamp(c.fallSpeed / 10, 0.3, 1), rate: 0.7, maxDist: 25 });
  c.fallSpeed = c.onFloor ? 0 : Math.max(c.fallSpeed, -c.velocity.y);
  c.wasOnFloor = c.onFloor;
  if (c.feet.y < PLAYER.killBelowY || c.feet.y < -40) killCombatant(c, null, 'fell');
}

function sfx(name, src, opts = {}) {
  if (src === player || !src) return sound.play(name, opts);
  return sound.play(name, { ...opts, pos: src.eye ? src.eye : src, listener: { pos: camera.position, yaw: player ? player.yaw : 0 } });
}

// ---------------------------------------------------------------------------
// Line of sight / ray casting
// ---------------------------------------------------------------------------
const tmpRay = new THREE.Ray();
function worldRay(origin, dir, max) {
  tmpRay.origin.copy(origin); tmpRay.direction.copy(dir);
  const r = worldOctree.rayIntersect(tmpRay);
  if (r && r.distance <= max) return r;
  // elevator platform as an extra blocker
  return null;
}
function hasLOS(a, b) {
  const d = b.clone().sub(a); const len = d.length(); d.divideScalar(len);
  const r = worldRay(a, d, len);
  return !r;
}
const raycaster = new THREE.Raycaster();
function shootRay(shooter, origin, dir, range) {
  const wr = worldRay(origin, dir, range);
  const maxD = wr ? wr.distance : range;
  raycaster.set(origin, dir); raycaster.far = maxD;
  const targets = [];
  for (const c of combatants) if (c !== shooter && !c.dead && c.hitboxes) targets.push(...c.hitboxes);
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) return { point: hits[0].point, distance: hits[0].distance, target: hits[0].object.owner, head: !!hits[0].object.isHead };
  if (wr) return { point: wr.position, distance: wr.distance, normal: wr.triangle.getNormal(new THREE.Vector3()), target: null };
  return { point: origin.clone().addScaledVector(dir, range), distance: range, target: null, miss: true };
}

// ---------------------------------------------------------------------------
// Effects: tracers, impacts, muzzle flashes, explosions
// ---------------------------------------------------------------------------
const effects = [];
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, toneMapped: false });
function spawnTracer(from, to) {
  const len = from.distanceTo(to);
  if (len < 1) return;
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(g, tracerMat); line.frustumCulled = false; scene.add(line);
  const dir = to.clone().sub(from).normalize();
  effects.push({ t: 0, life: len / 300, update(dt) {
    this.t += dt; const k = Math.min(1, this.t / this.life);
    const head = from.clone().addScaledVector(dir, len * k), tail = from.clone().addScaledVector(dir, Math.max(0, len * k - 4));
    g.attributes.position.setXYZ(0, tail.x, tail.y, tail.z); g.attributes.position.setXYZ(1, head.x, head.y, head.z); g.attributes.position.needsUpdate = true;
    return k < 1;
  }, dispose() { scene.remove(line); g.dispose(); } });
}
const impactGeo = new THREE.PlaneGeometry(0.08, 0.08);
const impactMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
const puffMat = new THREE.SpriteMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8, depthWrite: false });
function spawnImpact(point, normal) {
  const m = new THREE.Mesh(impactGeo, impactMat.clone());
  m.position.copy(point).addScaledVector(normal, 0.01); m.lookAt(point.clone().add(normal)); scene.add(m);
  const p = new THREE.Sprite(puffMat.clone()); p.position.copy(point).addScaledVector(normal, 0.05); p.scale.setScalar(0.1); scene.add(p);
  effects.push({ t: 0, update(dt) { this.t += dt; p.scale.setScalar(0.1 + this.t * 0.8); p.material.opacity = Math.max(0, 0.8 - this.t * 2.5); if (this.t > 6) m.material.opacity = Math.max(0, 1 - (this.t - 6)); return this.t < 7; }, dispose() { scene.remove(m); scene.remove(p); m.material.dispose(); p.material.dispose(); } });
}
function spawnBlood(point) {
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xaa1111, transparent: true, depthWrite: false }));
    p.position.copy(point); p.scale.setScalar(0.07); scene.add(p);
    const v = new THREE.Vector3(rand(-1, 1), rand(0, 1.5), rand(-1, 1));
    effects.push({ t: 0, update(dt) { this.t += dt; v.y -= 6 * dt; p.position.addScaledVector(v, dt); p.material.opacity = 1 - this.t * 2.5; return this.t < 0.4; }, dispose() { scene.remove(p); p.material.dispose(); } });
  }
}
const flashTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,200,80,0.8)'); g.addColorStop(1, 'rgba(255,120,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function muzzleFlash(pos, targetScene = scene, size = 0.35) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.position.copy(pos); s.scale.setScalar(size); s.material.rotation = Math.random() * 6; targetScene.add(s);
  effects.push({ t: 0, update(dt) { this.t += dt; return this.t < 0.05; }, dispose() { targetScene.remove(s); s.material.dispose(); } });
}
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function explosionFX(pos, flash) {
  const light = new THREE.PointLight(flash ? 0xffffff : 0xffaa55, flash ? 200 : 120, 18, 1.5);
  light.position.copy(pos); scene.add(light);
  const ball = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: flash ? 0xffffff : 0xffcc88 }));
  ball.position.copy(pos); scene.add(ball);
  const smokes = [];
  for (let i = 0; i < (flash ? 6 : 12); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: flash ? 0xdddddd : 0x555555, transparent: true, depthWrite: false, opacity: 0.7 }));
    s.position.copy(pos); s.userData.v = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.5), rand(-1, 1)).multiplyScalar(flash ? 1 : 2.2);
    scene.add(s); smokes.push(s);
  }
  effects.push({ t: 0, update(dt) {
    this.t += dt;
    light.intensity = Math.max(0, (flash ? 200 : 120) * (1 - this.t / 0.15));
    ball.scale.setScalar((flash ? 3 : 4) * Math.min(1, this.t * 12)); ball.material.opacity = Math.max(0, 1 - this.t * 5);
    for (const s of smokes) { s.position.addScaledVector(s.userData.v, dt); s.userData.v.multiplyScalar(Math.exp(-2 * dt)); s.scale.setScalar(0.6 + this.t * 1.6); s.material.opacity = Math.max(0, 0.7 * (1 - this.t / 2.5)); }
    return this.t < 2.5;
  }, dispose() { scene.remove(light); scene.remove(ball); ball.material.dispose(); smokes.forEach((s) => { scene.remove(s); s.material.dispose(); }); } });
}

// ---------------------------------------------------------------------------
// Grenades
// ---------------------------------------------------------------------------
const grenades = [];
function throwGrenade(c) {
  if (c.grenades <= 0 || c.dead) return;
  c.grenades--;
  const type = c.grenadeType, G = GRENADES[type];
  const mesh = models[G.model].clone(); scene.add(mesh);
  const pitch = c.pitch + -PLAYER.throwAngleOffset * DEG;
  const dir = new THREE.Vector3(-Math.sin(c.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(c.yaw) * Math.cos(pitch));
  const start = c.eye.addScaledVector(dir, 0.5);
  const r = worldRay(c.eye, dir, 0.6); if (r) start.copy(c.eye);
  grenades.push({ type, G, owner: c, mesh, pos: start, vel: dir.multiplyScalar(PLAYER.throwForce * (c.throwPower || 1)).add(c.velocity.clone().multiplyScalar(0.5)), t: 0, stuck: null, stuckOffset: null, spin: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), stuckWorld: false });
  if (c === player) hud.grenades();
}
const gSphere = new THREE.Sphere(new THREE.Vector3(), 0.06);
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.t += dt;
    if (g.stuck) {
      if (g.stuck.dead) { g.pos.copy(g.stuck.feet).add(g.stuckOffset); g.stuck = null; g.stuckWorld = true; }
      else g.pos.copy(g.stuck.feet).add(g.stuckOffset);
    } else if (!g.stuckWorld) {
      const sub = 3;
      for (let s = 0; s < sub; s++) {
        const h = dt / sub;
        g.vel.y -= GRENADE_GRAVITY * h;
        g.pos.addScaledVector(g.vel, h);
        gSphere.center.copy(g.pos);
        const r = worldOctree.sphereIntersect(gSphere);
        if (r) {
          g.pos.addScaledVector(r.normal, r.depth);
          if (g.G.sticky) { g.stuckWorld = true; g.vel.set(0, 0, 0); break; }
          const vn = r.normal.dot(g.vel);
          if (vn < 0) { g.vel.addScaledVector(r.normal, -vn * 1.4); g.vel.multiplyScalar(0.7); g.spin.multiplyScalar(0.7); }
        }
        // elevator floor
        if (inElevatorXZ(g.pos) && g.pos.y < elevator.y + 0.06 && g.pos.y > elevator.y - 1) { g.pos.y = elevator.y + 0.06; if (g.vel.y < 0) g.vel.y *= -0.3; g.vel.x *= 0.9; g.vel.z *= 0.9; }
        // sticky on combatants
        if (g.G.sticky && g.t > 0.08) {
          for (const c of combatants) {
            if (c.dead || (c === g.owner && g.t < 0.4)) continue;
            const p = closestOnSegment(c.capsule.start, c.capsule.end, g.pos);
            if (p.distanceTo(g.pos) < PLAYER.radius + 0.08) { g.stuck = c; g.stuckOffset = g.pos.clone().sub(c.feet); break; }
          }
          if (g.stuck) break;
        }
      }
      g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt; g.mesh.rotation.z += g.spin.z * dt;
    }
    g.mesh.position.copy(g.pos);
    if (g.t >= g.G.fuse) { explode(g); scene.remove(g.mesh); grenades.splice(i, 1); }
  }
}
function closestOnSegment(a, b, p) {
  const ab = b.clone().sub(a); const t = clamp(p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
  return a.clone().addScaledVector(ab, t);
}
function explode(g) {
  const pos = g.pos.clone().add(new THREE.Vector3(0, 0.05, 0));
  explosionFX(pos, !!g.G.flash);
  sfx(g.G.flash ? 'flashbang-explosion' : 'explosion', pos, { volume: 1, maxDist: 80 });
  for (const c of combatants) {
    if (c.dead) continue;
    const target = closestOnSegment(c.capsule.start, c.capsule.end, pos);
    const d = target.distanceTo(pos);
    if (d > g.G.range) continue;
    const visible = hasLOS(pos, c.eye) || hasLOS(pos, c.chest) || (g.stuck === c);
    if (!visible) continue;
    if (g.G.flash) {
      const toG = pos.clone().sub(c.eye).normalize();
      const fwd = new THREE.Vector3(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
      const facing = fwd.dot(toG) > 0.2 ? 1 : 0.45;
      const time = g.G.maxFlash * (1 - d / g.G.range * 0.6) * facing;
      if (c === player) flashPlayer(time); else c.blindUntil = game.time + time + 0.5;
    } else {
      const dmg = g.G.damage * (1 - d / g.G.range);
      damage(c, dmg, g.owner, g.type === 'sticky' ? 'Sticky Grenade' : 'Frag Grenade', pos);
    }
  }
}

// ---------------------------------------------------------------------------
// Damage / death / respawn
// ---------------------------------------------------------------------------
function damage(c, amount, src, weaponName, fromPos) {
  if (c.dead || c.invincible || amount <= 0 || game.over) return;
  c.health -= amount; c.lastHurt = game.time; c.lastAttacker = src;
  if (c.isBot && src && src !== c) c.ai.onHurt(src);
  if (c === player) {
    sound.play('hit', { volume: 0.8, rate: rand(0.95, 1.05) });
    hud.damage(amount, fromPos);
  } else spawnBlood(c.chest);
  if (src === player && c !== player) hud.hitmarker(c.health <= 0);
  if (c.health <= 0) killCombatant(c, src, weaponName);
}
function killCombatant(c, killer, weaponName) {
  if (c.dead) return;
  c.dead = true; c.health = 0; c.deaths++;
  if (killer && killer !== c) killer.kills++;
  hud.killfeed(killer, c, weaponName);
  if (c.body) c.body.visible = false;
  // ragdoll-ish corpse marker
  if (c.body) spawnCorpse(c);
  if (c === player) {
    game.aiming = false; vm.group.visible = false;
    $('death').classList.remove('hidden');
    $('death-by').textContent = killer && killer !== c ? `Killed by ${killer.name}` : weaponName === 'fell' ? 'You fell' : 'You killed yourself';
    c.respawnAt = game.time + 3;
    stopHeartbeat();
  } else c.respawnAt = game.time + 3;
  hud.scores();
  if (killer && killer.kills >= settings.scoreLimit && settings.scoreLimit > 0) endMatch();
}
function spawnCorpse(c) {
  const corpse = c.body.clone(); corpse.visible = true;
  corpse.traverse((o) => { if (o.material && o.material.visible === false) o.visible = false; });
  corpse.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; } });
  scene.add(corpse);
  const fallDir = Math.random() < 0.5 ? 1 : -1;
  effects.push({ t: 0, update(dt) {
    this.t += dt;
    corpse.rotation.x = Math.min(Math.PI / 2, this.t * 5) * fallDir * 0.95;
    corpse.position.y = c.body.position.y + Math.min(0.25, this.t);
    if (this.t > 2.5) corpse.traverse((o) => { if (o.isMesh) o.material.opacity = Math.max(0, 1 - (this.t - 2.5)); });
    return this.t < 3.5;
  }, dispose() { scene.remove(corpse); corpse.traverse((o) => { if (o.isMesh) o.material.dispose(); }); } });
}
function pickSpawn(c) {
  const enemies = combatants.filter((o) => o !== c && !o.dead);
  const cands = SPAWNS.map((s) => nav.pos[nearestNode(new THREE.Vector3(s[0], s[1] - 1, s[2]))]).filter(Boolean);
  for (let i = 0; i < 40; i++) cands.push(nav.pos[Math.floor(Math.random() * nav.pos.length)]);
  const scored = cands.map((p) => {
    let md = 999;
    for (const e of enemies) { const d = e.feet.distanceTo(p); if (d < md) md = d; }
    const seen = enemies.some((e) => e.feet.distanceTo(p) < 35 && hasLOS(e.eye, p.clone().add(new THREE.Vector3(0, 1.5, 0))));
    return { p, s: md - (seen ? 30 : 0) - (nav.w[nav.pos.indexOf(p)] || 0) * 20 + rand(0, 6) };
  }).sort((a, b) => b.s - a.s);
  return scored[0].p.clone();
}
function respawn(c) {
  if (c === player && game.nextLoadout != null) { settings.loadout = game.nextLoadout; game.nextLoadout = null; saveSettings(); }
  c.setLoadout(c === player ? settings.loadout : (c.ai.loadoutPref ?? Math.floor(Math.random() * LOADOUTS.length)));
  c.placeAt(pickSpawn(c));
  c.dead = false; c.health = PLAYER.maxHealth; c.invincibleUntil = game.time + PLAYER.respawnInvincibility;
  c.blindUntil = 0;
  if (c.body) { c.body.visible = true; c.setGunModel(); }
  if (c === player) {
    $('death').classList.add('hidden');
    // face toward map center-ish
    c.yaw = Math.atan2(c.feet.x, c.feet.z); c.pitch = 0;
    vm.setWeapon(c.weapon); hud.ammo(); hud.grenades(); hud.loadoutName();
  } else c.ai.reset();
}

// ---------------------------------------------------------------------------
// Shooting
// ---------------------------------------------------------------------------
function damageFalloff(gd, dist) {
  return gd.Damage * Math.max(0.1, Math.pow(gd.DamageMultiplierPerMeter, dist / 4));
}
function fireWeapon(c, aimDir, origin, { spreadExtra = 0 } = {}) {
  const w = c.weapon, gd = w.d;
  if (w.reloading || game.time < w.nextFire || c.dead) return false;
  if (w.ammo <= 0) { startReload(c); return false; }
  w.nextFire = game.time + 60 / gd.Rpm;
  w.ammo--;
  // spread: current shot spread + movement, reduced by aiming
  const speed = Math.hypot(c.velocity.x, c.velocity.z);
  let spread = (w.spread + speed * gd.MovementSpreadAngleMultiplier) * (c.aimK != null ? THREE.MathUtils.lerp(1, w.info.aimMult, c.aimK) : 1) + spreadExtra;
  if (c.stance === 'crouch') spread *= 0.8; else if (c.stance === 'prone') spread *= 0.6;
  w.spread = Math.min(gd.MaxShootSpreadAngle, w.spread + gd.SpreadAngleIncreasePerShot);
  const dir = coneDir(aimDir, spread * DEG);
  const hit = shootRay(c, origin, dir, gd.Range);
  if (hit.target) damage(hit.target, damageFalloff(gd, hit.distance), c, gd.Name, origin);
  else if (hit.normal) spawnImpact(hit.point, hit.normal);
  // sound with low-ammo pitch shift (like the original)
  let pitch = gd.GunshotPitch + rand(-gd.GunshotPitchVariance, gd.GunshotPitchVariance);
  if (gd.AmmoToIncreaseGunshotPitch > 0 && w.ammo < gd.AmmoToIncreaseGunshotPitch) pitch += gd.LowAmmoAdditionalPitch * (1 - w.ammo / gd.AmmoToIncreaseGunshotPitch);
  sfx('gunshot', c, { volume: gd.GunshotVolume * (c === player ? 0.55 : 0.9), rate: pitch, maxDist: 90 });
  return { hit, dir };
}
function coneDir(dir, angle) {
  if (angle <= 0) return dir.clone();
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * Math.tan(angle / 2);
  const up = Math.abs(dir.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, up).normalize(), v = new THREE.Vector3().crossVectors(u, dir);
  return dir.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
}
function startReload(c) {
  const w = c.weapon;
  if (w.reloading || w.ammo >= w.d.MaxAmmo || w.stored <= 0) return;
  w.reloadStart = game.time; w.reloadingUntil = game.time + w.d.ReloadTime;
  w.pendingReload = true;
}
function updateWeaponTimers(c, dt) {
  for (const w of c.weapons) {
    w.spread = Math.max(0, w.spread - w.d.SpreadAngleReductionPerSecond * dt);
    if (w.pendingReload && game.time >= w.reloadingUntil) {
      w.pendingReload = false;
      const need = w.d.MaxAmmo - w.ammo, take = Math.min(need, w.stored);
      w.ammo += take; w.stored -= take;
      if (c === player) hud.ammo();
    }
  }
}
function switchWeapon(c, idx) {
  if (idx === c.wi || !c.weapons[idx]) return;
  const w = c.weapon; if (w.pendingReload) { w.pendingReload = false; w.reloadingUntil = 0; }
  c.wi = idx;
  c.weapon.nextFire = Math.max(c.weapon.nextFire, game.time + 0.25);
  if (c === player) { vm.setWeapon(c.weapon); hud.ammo(); }
  else c.setGunModel();
}

// ---------------------------------------------------------------------------
// Viewmodel: springs for aim, sway, bob, recoil, reload spin (ported from GunMovement)
// ---------------------------------------------------------------------------
class Spring { constructor() { this.x = new THREE.Vector3(); this.v = new THREE.Vector3(); }
  step(target, k, c, dt) { const a = target.clone().sub(this.x).multiplyScalar(k).addScaledVector(this.v, -c); this.v.addScaledVector(a, dt); this.x.addScaledVector(this.v, dt); } }
const vm = {
  group: new THREE.Group(), gun: null, w: null,
  off: new Spring(), offRot: new Spring(), sway: new Spring(), bob: new Spring(), rp: new Spring(), rr: new Spring(),
  bobStep: 0, laserLine: null, laserDot: null,
  setWeapon(w) {
    if (this.gun) this.group.remove(this.gun);
    const b = buildGun(w.key, w.att); this.gun = b.root; w.info = b.info; this.w = w;
    this.gun.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
    this.group.add(this.gun);
    const gd = w.d;
    this.hip = uPos(gd.HipPositionalOffset); this.hipRot = uRot(gd.HipRotationalOffset);
    this.aimRot = uRot(gd.AimRotationalOffset);
    if (w.info.reticle) {
      // align optic reticle with the camera center at the preferred distance
      const q = new THREE.Quaternion().setFromEuler(this.aimRot);
      const r = w.info.reticle.clone().applyQuaternion(q);
      this.aim = new THREE.Vector3(0, 0, -w.info.preferredDist).sub(r);
    } else this.aim = uPos(gd.AimPositionalOffset);
    this.off.x.copy(this.hip).add(new THREE.Vector3(0, -0.25, 0)); this.off.v.set(0, 0, 0);
    if (this.laserLine) { vmScene.remove(this.laserLine); this.laserLine = null; }
    if (w.info.laser) {
      const mat = new THREE.MeshBasicMaterial({ color: w.info.laserColor, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false });
      this.laserLine = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), mat);
      this.gun.add(this.laserLine); this.laserLine.position.copy(w.info.laser);
      if (!this.laserDot) { this.laserDot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ toneMapped: false })); scene.add(this.laserDot); }
      this.laserDot.material.color.copy(w.info.laserColor);
    }
    if (this.laserDot) this.laserDot.visible = !!w.info.laser;
  },
  kick(w) {
    const gd = w.d;
    this.rp.v.add(uPos(gd.VisualPositionalRecoil));
    const r = gd.VisualRotationalRecoil;
    this.rr.v.add(new THREE.Vector3(r[0] * DEG * 3, rand(-r[1], r[1]) * DEG * 2, rand(-1, 1) * r[1] * DEG));
  },
  update(dt, aimK, mouse, speed) {
    const w = this.w; if (!w) return;
    const gd = w.d;
    const sub = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / sub;
    const target = this.hip.clone().lerp(this.aim, aimK);
    const lowered = game.sprinting && !game.aiming ? new THREE.Vector3(-0.02, -0.03, 0.02) : new THREE.Vector3();
    target.add(lowered);
    const swayT = new THREE.Vector3(clamp(-mouse.y, -gd.MaxMouseDelta, gd.MaxMouseDelta), clamp(-mouse.x, -gd.MaxMouseDelta, gd.MaxMouseDelta), 0).multiplyScalar(gd.SwayMultiplier * DEG * 0.35 * (1 - aimK * 0.7));
    if (speed > gd.BobSpeedThreshold && player.onFloor) this.bobStep += speed * dt * (game.sprinting ? 2.2 : 2.6);
    const amp = (speed > gd.BobSpeedThreshold && player.onFloor ? Math.min(speed, 7) * gd.BobStepMultiplier * 0.4 : 0) * (1 - aimK * 0.85);
    const bobT = new THREE.Vector3(Math.sin(this.bobStep) * gd.BobMultiplier[0] * amp, -Math.abs(Math.cos(this.bobStep)) * gd.BobMultiplier[1] * amp, 0);
    for (let i = 0; i < sub; i++) {
      this.off.step(target, gd.HipAimSpring, gd.HipAimDrag, h);
      this.sway.step(swayT, gd.SwaySpring, gd.SwayDrag, h);
      this.bob.step(bobT, gd.BobSpring, gd.BobDrag, h);
      this.rp.step(new THREE.Vector3(), gd.VisualPositionalRecoilSpring, gd.VisualPositionalRecoilDrag, h);
      this.rr.step(new THREE.Vector3(), gd.VisualRotationalRecoilSpring, gd.VisualRotationalRecoilDrag, h);
    }
    const rk = w.reloading ? clamp((game.time - w.reloadStart) / gd.ReloadTime, 0, 1) : 0;
    const spin = rk > 0 ? (rk * rk * (3 - 2 * rk)) * Math.PI * 2 : 0;
    const dip = rk > 0 ? Math.sin(rk * Math.PI) * 0.06 : 0;
    this.gun.position.copy(this.off.x).add(this.bob.x).addScaledVector(this.rp.x, 0.6 * (1 - aimK * 0.5)).add(new THREE.Vector3(0, -dip, 0));
    const e = new THREE.Euler().copy(this.hipRot);
    this.gun.quaternion.setFromEuler(e);
    const extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.sway.x.x + this.rr.x.x * (1 - aimK * 0.5) + spin + (game.sprinting && !game.aiming ? -0.25 : 0), this.sway.x.y + this.rr.x.y + (game.sprinting && !game.aiming ? 0.5 : 0), this.rr.x.z, 'YXZ'));
    this.gun.quaternion.premultiply(extra);
  },
  barrelWorld() {
    // barrel point of the viewmodel gun, converted to world space via the main camera
    const p = this.w.info.barrel.clone(); this.gun.localToWorld(p);
    return p.applyMatrix4(camera.matrixWorld);
  },
};
vmScene.add(vm.group);

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------
function makeBotBody(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0b08a, roughness: 0.8 });
  const part = (w, h, d, m, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.13, 0.9, 0); legR.position.set(0.13, 0.9, 0); g.add(legL, legR);
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.22), dark); l1.position.y = -0.45; legL.add(l1);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.22), dark); l2.position.y = -0.45; legR.add(l2);
  const torso = part(0.52, 0.66, 0.3, mat, 0, 1.24, 0);
  const head = part(0.3, 0.32, 0.3, skin, 0, 1.76, 0);
  const helmet = part(0.34, 0.12, 0.34, mat, 0, 1.94, 0);
  const visor = part(0.24, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, 1.79, -0.16);
  const armR = part(0.14, 0.14, 0.5, mat, 0.2, 1.38, -0.25);
  const armL = part(0.14, 0.14, 0.55, mat, -0.08, 1.36, -0.32); armL.rotation.y = -0.5;
  const gunMount = new THREE.Group(); gunMount.position.set(0.16, 1.4, -0.1); g.add(gunMount);
  // hitboxes (invisible, generous)
  const hbMat = new THREE.MeshBasicMaterial({ visible: false });
  const hbBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.45), hbMat); hbBody.position.y = 0.78; g.add(hbBody);
  const hbHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), hbMat); hbHead.position.y = 1.78; g.add(hbHead);
  return { g, legL, legR, torso, head, helmet, gunMount, hitboxes: [hbBody, hbHead], hbHead, mats: [mat, dark, skin] };
}

class BotAI {
  constructor(bot) { this.bot = bot; this.reset(); this.loadoutPref = Math.floor(Math.random() * LOADOUTS.length); }
  reset() {
    this.state = 'roam'; this.path = null; this.pi = 0; this.target = null; this.lastSeenPos = null; this.lastSeenTime = -99;
    this.reactAt = 0; this.nextThink = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeUntil = 0;
    this.stuckT = 0; this.lastPos = this.bot.feet; this.errOff = new THREE.Vector3(); this.errUntil = 0; this.nextShot = 0;
    this.wantCrouchUntil = 0; this.grenadeCD = game.time + rand(5, 12); this.jumpNow = false; this.visibleSince = 0;
  }
  onHurt(src) {
    if (!src || src === this.bot || src.dead) return;
    if (!this.target || this.target.dead || this.state !== 'combat') { this.target = src; this.lastSeenPos = src.feet; this.lastSeenTime = game.time; this.state = 'hunt'; this.path = null; this.hurtTurn = true; }
  }
  canSee(o) {
    const b = this.bot, diff = DIFFICULTY[settings.difficulty];
    if (game.time < b.blindUntil) return false;
    const to = o.chest.sub(b.eye); const d = to.length();
    if (d > diff.see) return false;
    const fwd = new THREE.Vector3(-Math.sin(b.yaw), 0, -Math.cos(b.yaw));
    const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
    const recentlyHit = game.time - b.lastHurt < 2 && b.lastAttacker === o;
    if (fwd.dot(flat) < Math.cos(70 * DEG) && !recentlyHit && d > 4) return false;
    return hasLOS(b.eye, o.eye) || hasLOS(b.eye, o.chest);
  }
  think() {
    const b = this.bot;
    let best = null, bd = Infinity;
    for (const o of combatants) {
      if (o === b || o.dead) continue;
      const d = o.feet.distanceTo(b.feet);
      const pref = o === this.target ? 0.7 : 1; // stick to current target
      if (d * pref < bd && this.canSee(o)) { bd = d * pref; best = o; }
    }
    if (best) {
      if (best !== this.target || this.state !== 'combat') { this.reactAt = game.time + DIFFICULTY[settings.difficulty].react * rand(0.8, 1.3); this.visibleSince = game.time; }
      this.target = best; this.state = 'combat'; this.lastSeenPos = best.feet; this.lastSeenTime = game.time; this.path = null;
    } else if (this.state === 'combat') {
      this.state = 'hunt'; this.path = null;
    }
    if (this.state === 'hunt' && (game.time - this.lastSeenTime > 7 || !this.target || this.target.dead)) { this.state = 'roam'; this.path = null; this.target = null; }
    if (this.state !== 'combat' && !this.path) {
      const startN = nearestNode(b.feet);
      let goal;
      if (this.state === 'hunt' && this.lastSeenPos) goal = nearestNode(this.lastSeenPos);
      else {
        // roam: sometimes head toward a random enemy's area, otherwise anywhere
        const enemies = combatants.filter((o) => o !== b && !o.dead);
        if (enemies.length && Math.random() < 0.45) { const e = enemies[Math.floor(Math.random() * enemies.length)]; goal = nearestNode(e.feet.add(new THREE.Vector3(rand(-6, 6), 0, rand(-6, 6)))); if (goal < 0) goal = nearestNode(e.feet); }
        else goal = Math.floor(Math.random() * nav.pos.length);
      }
      this.path = astar(startN, goal); this.pi = 0;
      if (!this.path || this.path.length < 2) { this.path = null; if (this.state === 'hunt') this.state = 'roam'; }
    }
    // weapon management
    const w = b.weapon;
    if (w.ammo === 0 && w.stored === 0) switchWeapon(b, b.wi ? 0 : 1);
    else if (w.ammo === 0 || (this.state !== 'combat' && w.ammo < w.d.MaxAmmo * 0.4)) startReload(b);
  }
  update(dt) {
    const b = this.bot, diff = DIFFICULTY[settings.difficulty];
    if (game.time >= this.nextThink) { this.think(); this.nextThink = game.time + rand(0.12, 0.22); }
    const wish = new THREE.Vector3();
    let sprint = false, desiredYaw = b.yaw, desiredPitch = 0;
    const blind = game.time < b.blindUntil;
    if (this.state === 'combat' && this.target && !this.target.dead) {
      const t = this.target;
      if (game.time > this.errUntil) {
        const e = diff.error * (blind ? 6 : 1) * (1 + Math.min(1.5, Math.hypot(t.velocity.x, t.velocity.z) / 4));
        this.errOff.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(Math.tan(e * DEG) * t.feet.distanceTo(b.feet));
        this.errUntil = game.time + rand(0.25, 0.6);
      }
      const aimP = t.chest.add(new THREE.Vector3(0, t.stance === 'stand' ? 0.25 : 0, 0)).add(this.errOff);
      const to = aimP.clone().sub(b.eye);
      desiredYaw = Math.atan2(-to.x, -to.z);
      desiredPitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
      const dist = to.length();
      // strafe & range keeping
      if (game.time > this.strafeUntil) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeUntil = game.time + rand(0.5, 1.6); if (Math.random() < 0.15) this.wantCrouchUntil = game.time + rand(1, 2.5); if (Math.random() < 0.08 && b.onFloor) this.jumpNow = true; }
      const right = new THREE.Vector3(Math.cos(desiredYaw), 0, -Math.sin(desiredYaw));
      const fwd = new THREE.Vector3(-Math.sin(desiredYaw), 0, -Math.cos(desiredYaw));
      wish.addScaledVector(right, this.strafe);
      const ideal = b.weapon.d.Rpm < 500 ? 22 : b.weapon.key === 'G17' ? 9 : 13;
      if (dist > ideal + 6) wish.addScaledVector(fwd, 0.8); else if (dist < ideal - 6) wish.addScaledVector(fwd, -0.6);
      // shooting
      const yawErr = Math.abs(angleDiff(desiredYaw, b.yaw)), pitchErr = Math.abs(desiredPitch - b.pitch);
      if (game.time > this.reactAt && yawErr < 6 * DEG && pitchErr < 6 * DEG && game.time >= this.nextShot && dist < b.weapon.d.Range) {
        const dir = new THREE.Vector3(-Math.sin(b.yaw) * Math.cos(b.pitch), Math.sin(b.pitch), -Math.cos(b.yaw) * Math.cos(b.pitch));
        const res = fireWeapon(b, dir, b.eye, { spreadExtra: (diff.spreadMult - 1) * 2 + (blind ? 8 : 0) });
        if (res) {
          spawnTracer(b.gunBarrelWorld(), res.hit.point); muzzleFlash(b.gunBarrelWorld(), scene, 0.3);
          const auto = b.weapon.d.ShootingType === 0;
          const gap = 60 / b.weapon.d.Rpm;
          // bursts for auto weapons, cadence for semi
          if (auto) { this.burst = (this.burst || 0) + 1; this.nextShot = game.time + (this.burst > rand(3, 7) ? (this.burst = 0, rand(0.25, 0.5) * diff.fireGap) : gap); }
          else this.nextShot = game.time + Math.max(gap, rand(0.25, 0.5) * diff.fireGap * (b.weapon.key === 'BT .50 Cal' ? 2.2 : 1));
        }
      }
      // grenades
      if (b.grenades > 0 && game.time > this.grenadeCD && dist > 7 && dist < 18 && game.time - this.visibleSince > 1.5 && Math.random() < 0.02) {
        this.grenadeCD = game.time + rand(10, 20);
        const savedP = b.pitch; b.pitch = clamp(desiredPitch + (dist - 7) / 11 * 18 * DEG, -0.3, 0.7); b.throwPower = clamp(dist / 14, 0.6, 1.3);
        throwGrenade(b); b.pitch = savedP; b.throwPower = 1;
      }
    } else if (this.path) {
      // follow path
      let node = nav.pos[this.path[this.pi]];
      const f = b.feet;
      while (node && Math.hypot(node.x - f.x, node.z - f.z) < 0.7) { this.pi++; node = nav.pos[this.path[this.pi]]; }
      if (!node) { this.path = null; if (this.state === 'hunt') { this.state = 'roam'; } }
      else {
        // look ahead: skip to a further node if visible
        const ahead = nav.pos[this.path[Math.min(this.pi + 3, this.path.length - 1)]];
        const tgt = ahead && Math.abs(ahead.y - f.y) < 0.4 && hasLOS(f.clone().add(new THREE.Vector3(0, 0.6, 0)), ahead.clone().add(new THREE.Vector3(0, 0.6, 0))) ? ahead : node;
        const d = new THREE.Vector3(tgt.x - f.x, 0, tgt.z - f.z).normalize();
        wish.copy(d); sprint = this.state === 'roam' ? Math.random() < 0.9 : true;
        desiredYaw = Math.atan2(-d.x, -d.z);
        if (this.hurtTurn && this.lastSeenPos) { const to = this.lastSeenPos.clone().sub(f); desiredYaw = Math.atan2(-to.x, -to.z); }
      }
    }
    if (this.hurtTurn && game.time - b.lastHurt > 1) this.hurtTurn = false;
    // turn toward desired aim
    const maxTurn = diff.turn * DEG * dt * (blind ? 0.3 : 1);
    b.yaw += clamp(angleDiff(desiredYaw, b.yaw), -maxTurn, maxTurn);
    b.pitch += clamp(desiredPitch - b.pitch, -maxTurn, maxTurn);
    // stance
    const wantCrouch = this.state === 'combat' && game.time < this.wantCrouchUntil;
    if (wantCrouch && b.stance === 'stand') b.setStance('crouch'); else if (!wantCrouch && b.stance !== 'stand') b.setStance('stand');
    // stuck detection
    if (wish.lengthSq() > 0.01) {
      this.stuckT += dt;
      if (this.stuckT > 0.8) {
        const moved = b.feet.distanceTo(this.lastPos);
        if (moved < 0.35) { this.jumpNow = true; if (this.state !== 'combat') this.path = null; else this.strafe *= -1; }
        this.lastPos = b.feet; this.stuckT = 0;
      }
    }
    if (wish.lengthSq() > 1) wish.normalize();
    moveCombatant(b, wish, dt, { sprint: sprint && this.state !== 'combat', jump: this.jumpNow });
    this.jumpNow = false;
  }
}
function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

function createBot(i) {
  const name = BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '');
  const c = new Combatant(name, true, BOT_COLORS[i % BOT_COLORS.length]);
  const body = makeBotBody(c.color);
  c.body = body.g; c.parts = body; c.hitboxes = body.hitboxes;
  body.hitboxes.forEach((h) => { h.owner = c; });
  body.hbHead.isHead = true;
  scene.add(c.body); c.body.visible = false;
  c.ai = new BotAI(c);
  c.setGunModel = function () {
    const m = this.parts.gunMount; m.clear();
    const b = buildGun(this.weapon.key, this.weapon.att); this.weapon.info = b.info;
    b.root.rotation.y = Math.PI; m.add(b.root); this.gunRoot = b.root;
  };
  c.gunBarrelWorld = function () { const p = this.weapon.info.barrel.clone(); this.gunRoot.updateWorldMatrix(true, false); return this.gunRoot.localToWorld(p); };
  return c;
}
function updateBotVisual(c, dt) {
  const p = c.parts, f = c.feet;
  c.body.position.set(f.x, f.y, f.z);
  c.body.rotation.y = c.yaw;
  const h = c.height / PLAYER.height;
  c.body.scale.y = THREE.MathUtils.lerp(c.body.scale.y, h, Math.min(1, dt * 12));
  p.gunMount.rotation.x = c.pitch;
  const sp = Math.hypot(c.velocity.x, c.velocity.z);
  c.walkPhase = (c.walkPhase || 0) + sp * dt * 2.2;
  const sw = Math.sin(c.walkPhase) * Math.min(0.7, sp * 0.15);
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  const inv = c.invincible;
  for (const m of p.mats) { m.transparent = inv; m.opacity = inv ? 0.45 + 0.25 * Math.sin(game.time * 20) : 1; }
  c.body.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const hud = {
  vignette: 0, hitT: 0, flashT: 0, flashMax: 1, killfeedEl: $('killfeed'),
  ammo() { const w = player.weapon; $('ammo').textContent = `${w.ammo}`; $('ammo-stored').textContent = `/ ${w.stored}`; $('gun-name').textContent = w.d.Name; $('gun-icon').src = `assets/ui/${w.d.icon}.png`; },
  grenades() { const G = GRENADES[player.grenadeType]; $('gren-icon').src = `assets/ui/${G.icon}.png`; $('gren-count').textContent = `x${player.grenades}`; },
  loadoutName() { $('loadout-name').textContent = player.loadout.name; },
  damage(amount, fromPos) {
    this.vignette = Math.min(1, this.vignette + amount / 40);
    if (fromPos) {
      const to = fromPos.clone().sub(player.eye); const ang = Math.atan2(-to.x, -to.z) - player.yaw;
      const el = document.createElement('div'); el.className = 'dmg-ind'; el.style.transform = `translate(-50%,-50%) rotate(${-ang}rad) translateY(-90px)`;
      $('hud').appendChild(el); setTimeout(() => el.remove(), 900);
    }
  },
  hitmarker(kill) { const h = $('hitmarker'); h.classList.remove('show', 'kill'); void h.offsetWidth; h.classList.add('show'); if (kill) h.classList.add('kill'); },
  killfeed(killer, victim, weapon) {
    const el = document.createElement('div'); el.className = 'kf';
    const nm = (c) => `<span style="color:#${c === player ? 'ffd54a' : new THREE.Color(c.color || 0xffffff).getHexString()}">${escapeHTML(c.name)}</span>`;
    if (killer && killer !== victim) el.innerHTML = `${nm(killer)} <span class="kf-w">[${escapeHTML(weapon)}]</span> ${nm(victim)}`;
    else el.innerHTML = `${nm(victim)} <span class="kf-w">${weapon === 'fell' ? '[fell]' : '[suicide]'}</span>`;
    this.killfeedEl.prepend(el); setTimeout(() => el.remove(), 5000);
    while (this.killfeedEl.children.length > 5) this.killfeedEl.lastChild.remove();
    if (killer === player && victim !== player) { const b = $('killbanner'); b.textContent = `ELIMINATED ${victim.name.toUpperCase()}`; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
  },
  scores() {
    const sorted = [...combatants].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    $('lb-body').innerHTML = sorted.map((c, i) => `<tr class="${c === player ? 'me' : ''}"><td>${i + 1}</td><td><span class="dot" style="background:#${c === player ? 'ffd54a' : new THREE.Color(c.color).getHexString()}"></span>${escapeHTML(c.name)}</td><td>${c.kills}</td><td>${c.deaths}</td></tr>`).join('');
    const rival = sorted.find((c) => c !== player);
    $('score-mine').textContent = player.kills; $('score-lead').textContent = rival ? rival.kills : 0;
    $('score-lead-label').textContent = 'BEST BOT';
  },
  update(dt) {
    // health
    const hp = Math.max(0, player.health);
    $('hp').textContent = Math.ceil(hp);
    $('hp-fill').style.width = `${hp}%`;
    $('hp-fill').style.background = hp > 50 ? '#e8e8e8' : hp > 25 ? '#ffb347' : '#ff4d4d';
    this.vignette = Math.max(0, this.vignette - dt * 0.8);
    const low = hp < 35 && !player.dead ? (35 - hp) / 35 * 0.6 : 0;
    $('vignette').style.opacity = Math.min(1, this.vignette + low);
    // flash
    if (this.flashT > 0) { this.flashT -= dt; const k = clamp(this.flashT / this.flashMax, 0, 1); $('flash').style.opacity = k < 0.6 ? k / 0.6 : 1; } else $('flash').style.opacity = 0;
    // crosshair spread
    const w = player.weapon; if (!w) return;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const spread = (w.spread + speed * w.d.MovementSpreadAngleMultiplier) * (player.stance === 'crouch' ? 0.8 : player.stance === 'prone' ? 0.6 : 1);
    const px = Math.tan(spread * DEG / 2) / Math.tan(camera.fov * DEG / 2) * window.innerHeight / 2;
    const gap = 4 + px;
    const ch = $('crosshair');
    ch.style.setProperty('--gap', `${gap}px`);
    ch.style.opacity = player.dead ? 0 : (1 - game.aimK) * (game.sprinting ? 0.3 : 1);
    const sc = w.info.scope && game.aimK > 0.92;
    $('scope').classList.toggle('hidden', !sc);
    vm.group.visible = !sc && !player.dead;
    $('reload').classList.toggle('hidden', !w.reloading);
    $('lowammo').classList.toggle('hidden', !(w.ammo <= Math.ceil(w.d.MaxAmmo * 0.2) && !w.reloading));
    $('lowammo').textContent = w.ammo === 0 ? (w.stored ? 'RELOAD [R]' : 'NO AMMO') : 'LOW AMMO';
    $('invuln').classList.toggle('hidden', !player.invincible || player.dead);
    // timer
    const left = Math.max(0, game.endTime - game.time);
    $('timer').textContent = settings.timeLimit > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : '∞';
    if (!player.dead) $('death').classList.add('hidden');
    else $('respawn-t').textContent = `Respawning in ${Math.max(0, Math.ceil(player.respawnAt - game.time))}`;
    // elevator hint
    const nearE = inElevatorXZ(player.feet, 0.4);
    $('hint').classList.toggle('hidden', !nearE);
  },
};
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function flashPlayer(time) {
  hud.flashT = Math.max(hud.flashT, time + 0.6); hud.flashMax = time + 0.6;
  const r = sound.play('ringing', { volume: 0.6 });
  if (r) { r.gain.gain.setValueAtTime(0.6, sound.ctx.currentTime); r.gain.gain.linearRampToValueAtTime(0, sound.ctx.currentTime + time + 1.2); }
}
let heartbeat = null;
function updateHeartbeat() {
  const low = player.health < 30 && !player.dead;
  if (low && !heartbeat) heartbeat = sound.play('heartbeat', { volume: 0.7, loop: true });
  else if (!low && heartbeat) stopHeartbeat();
}
function stopHeartbeat() { if (heartbeat) { try { heartbeat.src.stop(); } catch (e) { /* noop */ } heartbeat = null; } }

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = {};
const mouse = { dx: 0, dy: 0, left: false, right: false, middle: false, swayX: 0, swayY: 0 };
let pointerLocked = DEBUG;
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  keys[e.code] = true;
  if (game.state === 'playing' && pointerLocked) {
    if (e.code === 'Tab') { e.preventDefault(); $('leaderboard').classList.remove('hidden'); }
    if (player.dead) return;
    if (e.code === 'KeyR') startReload(player);
    if (e.code === 'Digit1') switchWeapon(player, 0);
    if (e.code === 'Digit2') switchWeapon(player, 1);
    if (e.code === 'KeyG') throwGrenade(player);
    if (e.code === 'ControlLeft' || e.code === 'KeyC') { e.preventDefault(); player.setStance(player.stance === 'crouch' ? 'stand' : 'crouch'); }
    if (e.code === 'KeyZ') player.setStance(player.stance === 'prone' ? 'stand' : 'prone') || player.setStance('crouch');
  } else if (game.state === 'loadout' && e.code === 'Enter') $('btn-deploy').click();
});
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Tab') $('leaderboard').classList.add('hidden');
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  mouse.dx += e.movementX; mouse.dy += e.movementY;
});
document.addEventListener('mousedown', (e) => {
  if (!pointerLocked) return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) mouse.right = true;
  if (e.button === 1) { mouse.middle = true; e.preventDefault(); }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) { mouse.left = false; mouse.semiReady = true; }
  if (e.button === 2) mouse.right = false;
  if (e.button === 1) mouse.middle = false;
});
let lastWheel = 0;
document.addEventListener('wheel', () => { const n = performance.now(); if (n - lastWheel < 200) return; lastWheel = n; if (pointerLocked && game.state === 'playing' && !player.dead) switchWeapon(player, player.wi ? 0 : 1); });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement || DEBUG;
  if (!pointerLocked && game.state === 'playing') openPause();
});
renderer.domElement.addEventListener('click', () => { if (game.state === 'playing') lockPointer(); });
$('clickplay').addEventListener('click', () => { if (game.state === 'playing') lockPointer(); });
function lockPointer() {
  sound.resume();
  if (DEBUG) return;
  const p = renderer.domElement.requestPointerLock({ unadjustedMovement: true });
  if (p && p.catch) p.catch(() => renderer.domElement.requestPointerLock());
}

// ---------------------------------------------------------------------------
// Game state / loop
// ---------------------------------------------------------------------------
const game = { state: 'loading', time: 0, aimK: 0, aiming: false, sprinting: false, endTime: 0, over: false, nextLoadout: null };
mouse.semiReady = true;

function startMatch() {
  // clear old
  for (const c of combatants) if (c.body) scene.remove(c.body);
  combatants.length = 0;
  grenades.forEach((g) => scene.remove(g.mesh)); grenades.length = 0;
  effects.forEach((e) => e.dispose()); effects.length = 0;
  game.time = 0; game.over = false; game.endTime = settings.timeLimit * 60;
  player = new Combatant(settings.name || 'Player', false, 0xffd54a);
  combatants.push(player);
  for (let i = 0; i < settings.bots; i++) combatants.push(createBot(i));
  // stagger bot spawns
  combatants.forEach((c, i) => { if (c.isBot) { c.dead = true; c.respawnAt = 0.2 + i * 0.15; } });
  player.dead = true; player.respawnAt = Infinity;
  hud.scores();
  $('killfeed').innerHTML = '';
  showScreen('loadout');
}

function deploy() {
  showScreen(null);
  game.state = 'playing';
  if (player.dead && player.respawnAt === Infinity) { respawn(player); }
  else if (player.dead) { /* waits for timer */ }
  else game.nextLoadout = settings.loadout;
  lockPointer();
}
function openPause() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = keys.ShiftLeft = false; mouse.left = mouse.right = false;
  $('leaderboard').classList.add('hidden');
  showScreen('pause');
}
function resume() { showScreen(null); game.state = 'playing'; lockPointer(); }
function endMatch() {
  if (game.over) return;
  game.over = true;
  setTimeout(() => {
    game.state = 'ended';
    document.exitPointerLock && document.exitPointerLock();
    const sorted = [...combatants].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    $('end-title').textContent = sorted[0] === player ? 'VICTORY' : `${sorted[0].name.toUpperCase()} WINS`;
    $('end-body').innerHTML = $('lb-body').innerHTML;
    stopHeartbeat();
    showScreen('end');
  }, 1200);
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  const needLock = game.state === 'playing' && !pointerLocked;
  $('clickplay').classList.toggle('hidden', !needLock);
  if (game.state === 'playing' && pointerLocked) update(dt);
  render();
}

function update(dt) {
  if (!player) return;
  const active = game.state === 'playing' && pointerLocked;
  game.time += dt;
  if (settings.timeLimit > 0 && game.time >= game.endTime && !game.over) endMatch();
  updateElevator(dt);

  // --- player input
  if (!player.dead) {
    const sens = 0.0022 * settings.sensitivity * (camera.fov / settings.fov);
    if (active) {
      player.yaw -= mouse.dx * sens; player.pitch -= mouse.dy * sens;
    }
    mouse.swayX = mouse.dx; mouse.swayY = mouse.dy;
    mouse.dx = mouse.dy = 0;
    // recoil (ported from GunRecoil: velocity with drag)
    player.pitch += player.recoil.x * dt * DEG; player.yaw += player.recoil.y * dt * DEG;
    player.recoil.multiplyScalar(Math.exp(-player.weapon.d.recoilDrag * dt));
    player.pitch = clamp(player.pitch, -89 * DEG, 89 * DEG);

    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const wish = new THREE.Vector3();
    if (active) {
      if (keys.KeyW) wish.add(fwd); if (keys.KeyS) wish.sub(fwd);
      if (keys.KeyD) wish.add(right); if (keys.KeyA) wish.sub(right);
    }
    if (wish.lengthSq() > 0) wish.normalize();
    game.aiming = active && (mouse.right || mouse.middle || keys.KeyQ) && !player.weapon.reloading;
    game.sprinting = active && keys.ShiftLeft && keys.KeyW && !game.aiming && player.stance === 'stand' && !mouse.left;
    if (game.sprinting && player.stance !== 'stand') game.sprinting = false;
    moveCombatant(player, wish, dt, { sprint: game.sprinting, jump: active && keys.Space });
    if (player.dead) return;
    game.aimK = damp(game.aimK, game.aiming ? 1 : 0, player.weapon.d.FovLerpSpeed * 1.2, dt);
    player.aimK = game.aimK;

    // shooting
    const w = player.weapon;
    const wantFire = active && mouse.left && !game.sprinting;
    if (wantFire && (w.d.ShootingType === 0 || mouse.semiReady)) {
      camera.updateMatrixWorld();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const res = fireWeapon(player, dir, camera.position.clone());
      if (res) {
        mouse.semiReady = false;
        const gripM = w.info.gripRecoil * (player.stance === 'crouch' ? 0.85 : player.stance === 'prone' ? 0.7 : 1) * THREE.MathUtils.lerp(1, 0.75, game.aimK);
        player.recoil.x += -w.d.Recoil[0] * gripM;
        player.recoil.y += rand(-w.d.Recoil[1], w.d.Recoil[1]) * gripM;
        vm.kick(w);
        const bw = vm.barrelWorld();
        spawnTracer(bw, res.hit.point);
        const flashP = w.info.barrel.clone(); vm.gun.localToWorld(flashP); muzzleFlash(flashP, vmScene, 0.12);
        hud.ammo();
      } else if (w.ammo === 0 && mouse.semiReady) { mouse.semiReady = false; }
    }
    if (!mouse.left) mouse.semiReady = true;
    if (active && w.ammo === 0 && !w.reloading && w.stored > 0 && mouse.left) startReload(player);
    if (settings.regen && game.time - player.lastHurt > 5 && player.health < PLAYER.maxHealth) player.health = Math.min(PLAYER.maxHealth, player.health + 12 * dt);
  } else {
    mouse.dx = mouse.dy = 0;
    if (game.time >= player.respawnAt && game.state === 'playing') respawn(player);
  }
  updateWeaponTimers(player, dt);

  // --- bots
  for (const c of combatants) {
    if (!c.isBot) continue;
    if (c.dead) { if (game.time >= c.respawnAt && !game.over) respawn(c); continue; }
    c.ai.update(dt);
    updateWeaponTimers(c, dt);
    if (settings.regen && game.time - c.lastHurt > 5 && c.health < PLAYER.maxHealth) c.health = Math.min(PLAYER.maxHealth, c.health + 12 * dt);
    updateBotVisual(c, dt);
  }
  updateGrenades(dt);
  for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].update(dt)) { effects[i].dispose(); effects.splice(i, 1); }

  // --- camera
  const eye = player.eye;
  camera.position.copy(eye);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  const w = player.weapon;
  if (w) {
    const targetFov = w.info.scope && game.aimK > 0.92 ? settings.fov * 0.22 : settings.fov * THREE.MathUtils.lerp(1, w.info.aimFovMult, game.aimK) * (game.sprinting ? 1.06 : 1);
    camera.fov = damp(camera.fov, targetFov, w.d.FovLerpSpeed, dt); camera.updateProjectionMatrix();
    vmCamera.fov = 60; vmCamera.updateProjectionMatrix();
    vm.update(dt, game.aimK, { x: mouse.swayX, y: mouse.swayY }, Math.hypot(player.velocity.x, player.velocity.z));
    // laser dot in the world
    if (vm.laserLine) {
      camera.updateMatrixWorld();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const hit = shootRay(player, camera.position, dir, w.info.laserRange);
      const len = hit.miss ? w.info.laserRange : hit.distance;
      vm.laserLine.scale.set(1, 1, Math.min(len, 3)); vm.laserDot.visible = !hit.miss && !player.dead; vm.laserDot.position.copy(hit.point);
      vm.laserLine.visible = !player.dead;
    }
  }
  hud.update(dt);
  updateHeartbeat();
}

function render() {
  renderer.clear();
  renderer.render(scene, camera);
  if (game.state !== 'menu' && player && !player.dead && vm.group.visible) {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------
function showScreen(id) {
  for (const s of ['menu', 'loadout', 'pause', 'end']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', !(id === null || id === 'pause'));
  if (id === 'loadout') { game.state = 'loadout'; buildLoadoutUI(); document.exitPointerLock && document.exitPointerLock(); }
  if (id === 'menu') game.state = 'menu';
}

let selLoadout = settings.loadout;
function buildLoadoutUI() {
  selLoadout = game.nextLoadout ?? settings.loadout;
  const list = $('lo-list'); list.innerHTML = '';
  LOADOUTS.forEach((L, i) => {
    const b = document.createElement('button'); b.className = 'lo-opt' + (i === selLoadout ? ' sel' : '');
    b.innerHTML = `<b>${L.name}</b><span>${GUNS[L.primary].Name} · ${GUNS[L.secondary].Name}</span>`;
    b.onclick = () => { selLoadout = i; buildLoadoutUI2(); [...list.children].forEach((x, j) => x.classList.toggle('sel', j === i)); };
    list.appendChild(b);
  });
  buildLoadoutUI2();
  $('lo-note').textContent = player && !player.dead && game.time > 0 ? 'Changes apply when you next respawn.' : '';
}
function buildLoadoutUI2() {
  const L = LOADOUTS[selLoadout];
  $('lo-name').textContent = L.name;
  $('lo-speed').textContent = `Speed: x${L.speedMult}`;
  $('lo-jump').textContent = `Jump: x${L.jumpMult}`;
  const G = GRENADES[L.grenade];
  const gunCard = (key, slot) => {
    const g = GUNS[key], a = settings.attachments[key];
    const sel = (type, opts) => opts.length > 1 ? `<label>${type}<select data-gun="${key}" data-type="${type.toLowerCase()}">${opts.map((o) => `<option value="${o}" ${a[type.toLowerCase()] === o ? 'selected' : ''}>${ATTACHMENTS[o].name}</option>`).join('')}</select></label>` : `<label>${type}<select disabled><option>None</option></select></label>`;
    const stats = `<div class="stats"><span>DMG ${g.Damage}</span><span>RPM ${g.Rpm}</span><span>MAG ${g.MaxAmmo}</span><span>${g.ShootingType === 0 ? 'AUTO' : 'SEMI'}</span></div>`;
    return `<div class="gun-card"><div class="slot">${slot}</div><img src="assets/ui/${g.icon}.png" alt=""><div class="gname">${g.Name}</div>${stats}<div class="atts">${sel('Optic', g.Optics)}${sel('Laser', g.Lasers)}${sel('Grip', g.Grips)}</div></div>`;
  };
  $('lo-guns').innerHTML = gunCard(L.primary, 'PRIMARY') + gunCard(L.secondary, 'SECONDARY') +
    `<div class="gun-card gren"><div class="slot">GRENADE</div><img src="assets/ui/${G.icon}.png" alt=""><div class="gname">${G.name} x${L.grenadeCount}</div></div>`;
  $('lo-guns').querySelectorAll('select[data-gun]').forEach((s) => s.onchange = () => { settings.attachments[s.dataset.gun][s.dataset.type] = s.value; saveSettings(); });
}

function setupMenus() {
  $('in-name').value = settings.name;
  $('in-bots').value = settings.bots; $('bots-val').textContent = settings.bots;
  $('in-diff').value = settings.difficulty;
  $('in-score').value = settings.scoreLimit; $('in-time').value = settings.timeLimit;
  $('in-regen').checked = settings.regen;
  $('in-bots').oninput = () => { $('bots-val').textContent = $('in-bots').value; };
  $('btn-play').onclick = () => {
    settings.name = ($('in-name').value || 'Player').replace(/[^\w !()+\-=.~%]/g, '').slice(0, 16) || 'Player';
    settings.bots = +$('in-bots').value; settings.difficulty = $('in-diff').value;
    settings.scoreLimit = +$('in-score').value; settings.timeLimit = +$('in-time').value; settings.regen = $('in-regen').checked;
    saveSettings(); sound.resume();
    startMatch();
  };
  $('btn-deploy').onclick = () => {
    if (player && !player.dead && game.time > 0) { game.nextLoadout = selLoadout; resume(); return; }
    settings.loadout = selLoadout; saveSettings(); deploy();
  };
  $('btn-resume').onclick = resume;
  $('btn-loadout').onclick = () => showScreen('loadout');
  $('btn-quit').onclick = () => { game.state = 'menu'; stopHeartbeat(); for (const c of combatants) if (c.body) scene.remove(c.body); combatants.length = 0; player = null; showScreen('menu'); };
  $('btn-again').onclick = () => startMatch();
  $('btn-menu').onclick = () => $('btn-quit').onclick();
  const bindRange = (id, key, fmt, apply) => { const el = $(id); el.value = settings[key]; $(id + '-v').textContent = fmt(settings[key]); el.oninput = () => { settings[key] = +el.value; $(id + '-v').textContent = fmt(settings[key]); apply && apply(); saveSettings(); }; };
  bindRange('set-sens', 'sensitivity', (v) => v.toFixed(2));
  bindRange('set-fov', 'fov', (v) => `${v}°`);
  bindRange('set-vol', 'volume', (v) => `${Math.round(v * 100)}%`, () => sound.setVolume(settings.volume));
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async () => {
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('mobile').classList.remove('hidden');
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    $('loadtext').textContent = 'Failed to load game files. If you opened index.html directly, run it from a web server (e.g. GitHub Pages).';
    return;
  }
  setupMenus();
  $('loading').classList.add('hidden');
  // menu backdrop camera
  camera.position.set(4, 1.8, -30); camera.lookAt(0, 1.2, -40);
  showScreen('menu');
  loop();
  let t = 0;
  (function menuCam() { if (game.state === 'menu') { t += 0.003; camera.position.set(Math.sin(t) * 6, 2.0, -34 + Math.cos(t) * 3); camera.lookAt(0, 1.5, -42); } requestAnimationFrame(menuCam); })();
  window.__game = { game, combatants, get player() { return player; }, camera, elevator, settings };
})();
