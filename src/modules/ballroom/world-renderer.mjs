// World renderer: builds a 1000×1000×1000 voxel cube containing multiple
// rooms placed at absolute world positions. Each room is either a known
// Ballroom instance (fetched from BALLROOM_REGISTRY) or built from a
// RoomTemplate (a lighter JSON that drives procedural geometry).
//
// API:
//   buildWorld({ world, templateMap, ballroomMap, THREE, scene, M, cssScene })
//   → { animate(t), portals, screens, blocks, addBlock(pos,mat), removeBlock(pos) }
//
// The 1000³ boundary is enforced by the controls layer (bounds object).

import { vox, cyl } from './scene.mjs';
import { buildPortals } from './portals.mjs';
import { buildScreens } from './screens.mjs';

// ─── ground plane ────────────────────────────────────────────────────────────
function buildGroundPlane(scene, THREE, M, worldSize) {
  const [W, , D] = worldSize;
  // Infinite-looking ground: one big slab at y=0
  vox(scene, THREE, -W / 2, -0.2, -D / 2, W, 0.2, D, M.floor, false, true);
}

// ─── room from template ───────────────────────────────────────────────────────
function buildRoomFromTemplate(tmpl, origin, scene, THREE, M, cssScene, allPortals, allScreens, allAnimated) {
  const [ox, oy, oz] = origin;
  const [W, H, D] = tmpl.size || [20, 6, 20];
  const fMat = M[tmpl.floorMat] || M.floor;
  const wMat = M[tmpl.wallMat] || M.wall;
  const cMat = M[tmpl.ceilMat] || M.wall;

  // Floor & ceiling
  vox(scene, THREE, ox - W/2, oy - 0.1, oz - D/2, W, 0.1, D, fMat, false, true);
  vox(scene, THREE, ox - W/2, oy + H,   oz - D/2, W, 0.3, D, cMat);

  // Walls (open front gap on +Z side for entry)
  const gap = Math.min(6, W * 0.4);
  // back wall
  vox(scene, THREE, ox - W/2, oy, oz - D/2, W, H, 0.4, wMat, true, true);
  // side walls
  vox(scene, THREE, ox - W/2, oy, oz - D/2, 0.4, H, D, wMat, true, true);
  vox(scene, THREE, ox + W/2 - 0.4, oy, oz - D/2, 0.4, H, D, wMat, true, true);
  // front wall with door gap
  vox(scene, THREE, ox - W/2, oy, oz + D/2 - 0.4, W/2 - gap/2, H, 0.4, wMat, true, true);
  vox(scene, THREE, ox + gap/2, oy, oz + D/2 - 0.4, W/2 - gap/2, H, 0.4, wMat, true, true);
  // lintel over door gap
  vox(scene, THREE, ox - gap/2, oy + H - 2, oz + D/2 - 0.4, gap, 2, 0.4, wMat, true, true);

  // Pillars (if requested)
  if (tmpl.pillars) {
    const cols = Math.max(2, Math.round(D / 8));
    for (let i = 0; i < cols; i++) {
      const z = oz - D/2 + 3 + i * (D - 6) / (cols - 1);
      cyl(scene, THREE, ox - W/2 + 2, oy, z, 0.4, H, M.pillar);
      cyl(scene, THREE, ox + W/2 - 2, oy, z, 0.4, H, M.pillar);
    }
  }

  // Room label text (floating sign above door)
  addRoomSign(scene, THREE, M, ox, oy + H + 0.4, oz + D/2, tmpl.name, tmpl.ambientHex);

  // Screens
  const localScreens = [...(tmpl.screens || [])];
  if (localScreens.length && cssScene) {
    // Translate screen positions by room origin
    const translatedScreens = localScreens.map(s => ({
      ...s,
      pos: [s.pos[0] + ox, s.pos[1] + oy, s.pos[2] + oz],
    }));
    const ss = buildScreens({ screens: translatedScreens, cssScene, THREE });
    allScreens.push(...ss.instances);
  }

  // Portals
  const localPortals = [...(tmpl.portals || [])];
  if (localPortals.length) {
    const translatedPortals = localPortals.map(p => ({
      ...p,
      pos: [p.pos[0] + ox, p.pos[1] + oy, p.pos[2] + oz],
    }));
    const ps = buildPortals({ portals: translatedPortals, THREE, scene });
    allPortals.push(...ps.instances);
    allAnimated.push((t) => ps.animate(t));
  }
}

// ─── ballroom in world ────────────────────────────────────────────────────────
function buildBallroomInWorld(ballroom, origin, scene, THREE, M, cssScene, allPortals, allScreens, allAnimated) {
  const [ox, oy, oz] = origin;
  const [W, H, D] = ballroom.size;

  // Outer floor + ceiling
  vox(scene, THREE, ox - W/2, oy - 0.1, oz - D/2, W, 0.1, D, M.floor, false, true);
  vox(scene, THREE, ox - W/2, oy + H,   oz - D/2, W, 0.3, D, M.wall);

  // Walls with entrance gap on +Z front
  vox(scene, THREE, ox - W/2, oy, oz - D/2, 0.4, H, D, M.wall, true, true);
  vox(scene, THREE, ox + W/2 - 0.4, oy, oz - D/2, 0.4, H, D, M.wall, true, true);
  vox(scene, THREE, ox - W/2, oy, oz - D/2, W, H, 0.4, M.wall, true, true);
  vox(scene, THREE, ox - W/2, oy, oz + D/2 - 0.4, W/2 - 3, H, 0.4, M.wall, true, true);
  vox(scene, THREE, ox + 3,   oy, oz + D/2 - 0.4, W/2 - 3, H, 0.4, M.wall, true, true);
  vox(scene, THREE, ox - 3,   oy + H - 2, oz + D/2 - 0.4, 6, 2, 0.4, M.wall, true, true);

  // Pillars
  for (let i = 0; i < 6; i++) {
    const z = oz - D/2 + 4 + i * (D - 8) / 5;
    cyl(scene, THREE, ox - W/2 + 2, oy, z, 0.4, H, M.pillar);
    cyl(scene, THREE, ox + W/2 - 2, oy, z, 0.4, H, M.pillar);
  }

  // Room label sign
  addRoomSign(scene, THREE, M, ox, oy + H + 0.4, oz + D/2, ballroom.name, ballroom.ambientHex);

  // Screens
  if ((ballroom.screens || []).length && cssScene) {
    const translated = (ballroom.screens || []).map(s => ({
      ...s,
      pos: [s.pos[0] + ox, s.pos[1] + oy, s.pos[2] + oz],
    }));
    const ss = buildScreens({ screens: translated, cssScene, THREE });
    allScreens.push(...ss.instances);
  }

  // Portals — translate to world coords, remap ballroom nav → world-nav
  const worldPortals = (ballroom.portals || []).map(p => ({
    ...p,
    pos: [p.pos[0] + ox, p.pos[1] + oy, p.pos[2] + oz],
    // In world mode, ballroom portals become walk-to hints, not page reloads.
    // Keep destination intact; portal-nav.mjs handles them.
  }));
  if (worldPortals.length) {
    const ps = buildPortals({ portals: worldPortals, THREE, scene });
    allPortals.push(...ps.instances);
    allAnimated.push((t) => ps.animate(t));
  }
}

// ─── floating room sign ───────────────────────────────────────────────────────
function addRoomSign(scene, THREE, M, x, y, z, name, _ambientHex) {
  // A flat trim-coloured box as a name plaque above the door
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(name.length * 0.18 + 0.4, 0.35, 0.08),
    M.trim
  );
  sign.position.set(x, y, z);
  scene.add(sign);
}

// ─── world-space path markers (ground lines between rooms) ───────────────────
function buildPathways(rooms, scene, THREE, M) {
  // Draw shallow ground-level tracks (thin floor strips) connecting the hub
  // [0,0,0] to each room. This gives visual wayfinding.
  const hub = [0, 0, 0];
  for (const wr of rooms) {
    const [tx, , tz] = wr.worldPos;
    const dx = tx - hub[0];
    const dz = tz - hub[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 5) continue; // already at center

    const mid = [hub[0] + dx / 2, -0.05, hub[2] + dz / 2];
    const angle = Math.atan2(dx, dz);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.05, len),
      M.trim
    );
    strip.position.set(mid[0], mid[1], mid[2]);
    strip.rotation.y = angle;
    scene.add(strip);
  }
}

// ─── door arch (decorative frame around an opening) ──────────────────────────
function buildDoorArch(scene, THREE, M, x, y, z, angle, width, height, mat) {
  const t = 0.3; // arch thickness
  const m = M[mat] || M.trim;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = angle;

  // Left jamb
  const left = new THREE.Mesh(new THREE.BoxGeometry(t, height, t), m);
  left.position.set(-width / 2 - t / 2, height / 2, 0);
  group.add(left);
  // Right jamb
  const right = new THREE.Mesh(new THREE.BoxGeometry(t, height, t), m);
  right.position.set(width / 2 + t / 2, height / 2, 0);
  group.add(right);
  // Lintel
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + t * 2, t, t), m);
  lintel.position.set(0, height + t / 2, 0);
  group.add(lintel);

  scene.add(group);
}

// ─── corridor connecting two rooms ────────────────────────────────────────────
function buildCorridor(roomA, roomB, conn, scene, THREE, M) {
  const ax = roomA.worldPos[0], ay = roomA.worldPos[1], az = roomA.worldPos[2];
  const bx = roomB.worldPos[0], by = roomB.worldPos[1], bz = roomB.worldPos[2];

  const dx = bx - ax, dz = bz - az;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1) return;

  const angle = Math.atan2(dx, dz); // rotation around Y so +Z aligns with line

  const W = conn.width || 4;
  const H = conn.height || 4;
  const T = 0.3; // wall thickness

  // Center of corridor (midpoint)
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const cy = (ay + by) / 2;

  const matFloor = M[conn.mat] || M.floor;
  const matWall = M.wall;
  const matCeil = M.wall;

  const group = new THREE.Group();
  group.position.set(cx, cy, cz);
  group.rotation.y = angle;

  // Floor (length along local Z)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, len), matFloor);
  floor.position.set(0, -0.1, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, len), matCeil);
  ceil.position.set(0, H + 0.1, 0);
  group.add(ceil);

  // Left wall
  const wL = new THREE.Mesh(new THREE.BoxGeometry(T, H, len), matWall);
  wL.position.set(-W / 2 - T / 2, H / 2, 0);
  wL.castShadow = true;
  group.add(wL);

  // Right wall
  const wR = new THREE.Mesh(new THREE.BoxGeometry(T, H, len), matWall);
  wR.position.set(W / 2 + T / 2, H / 2, 0);
  wR.castShadow = true;
  group.add(wR);

  // Glowing trim strip down the center of the floor (wayfinding)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, len), M.trim);
  stripe.position.set(0, 0.025, 0);
  group.add(stripe);

  scene.add(group);

  // Door arches at each end (in world space, not corridor space)
  buildDoorArch(scene, THREE, M, ax, ay, az, angle, W, H, conn.mat);
  buildDoorArch(scene, THREE, M, bx, by, bz, angle, W, H, conn.mat);
}

function buildConnections(world, roomById, scene, THREE, M) {
  const conns = world.connections || [];
  for (const c of conns) {
    const a = roomById.get(c.from);
    const b = roomById.get(c.to);
    if (!a || !b) {
      console.warn(`[world] connection refs unknown room: ${c.from} → ${c.to}`);
      continue;
    }
    buildCorridor(a, b, c, scene, THREE, M);
  }
}

// ─── sky dome ─────────────────────────────────────────────────────────────────
function buildSkyDome(scene, THREE, skyHex) {
  const geo = new THREE.SphereGeometry(490, 16, 8);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(skyHex || '#0d1117'), side: THREE.BackSide });
  scene.add(new THREE.Mesh(geo, mat));
}

// ─── main export ──────────────────────────────────────────────────────────────
export function buildWorld({ world, templateMap, ballroomMap, THREE, scene, M, cssScene = null }) {
  const allPortals = [];
  const allScreens = [];
  const allAnimated = [];
  const placedBlocks = new Map(); // key="x,y,z" → THREE.Mesh

  buildGroundPlane(scene, THREE, M, world.size);
  buildSkyDome(scene, THREE, world.skyHex);
  buildPathways(world.rooms, scene, THREE, M);

  // Build a lookup so connections can resolve room ids → positions.
  const roomById = new Map();
  for (const wr of world.rooms) roomById.set(wr.id, wr);

  // Corridors first so room walls render on top at the seams.
  buildConnections(world, roomById, scene, THREE, M);

  for (const wr of world.rooms) {
    const origin = wr.worldPos;
    const tmplId = wr.templateId;

    // Check if it's a Ballroom instance
    const ballroom = ballroomMap && ballroomMap.get(tmplId);
    if (ballroom) {
      buildBallroomInWorld(ballroom, origin, scene, THREE, M, cssScene, allPortals, allScreens, allAnimated);
      continue;
    }

    // Check if it's a RoomTemplate
    const tmpl = templateMap && templateMap.get(tmplId);
    if (tmpl) {
      buildRoomFromTemplate(tmpl, origin, scene, THREE, M, cssScene, allPortals, allScreens, allAnimated);
      continue;
    }

    console.warn(`[world] unknown templateId "${tmplId}" for room "${wr.id}"`);
  }

  // Pre-existing world blocks (loaded from JSON)
  for (const blk of world.blocks || []) {
    placeBlock(blk.pos, blk.mat, M, THREE, scene, placedBlocks);
  }

  // Lighting — wide-area setup for an outdoor world feel
  const ambient = new THREE.AmbientLight(0x111827, 0.8);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffeedd, 0.6);
  sun.position.set(80, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 600;
  sun.shadow.camera.left = -300;
  sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300;
  sun.shadow.camera.bottom = -300;
  scene.add(sun);

  // Portal lights (point lights placed at room centers for ambiance)
  for (const wr of world.rooms) {
    const [px, , pz] = wr.worldPos;
    const ptLight = new THREE.PointLight(0x4488ff, 0.5, 30);
    ptLight.position.set(px, 4, pz);
    scene.add(ptLight);
  }

  function placeBlock(pos, matKey, M, THREE, scene, map) {
    const [x, y, z] = pos;
    const key = `${x},${y},${z}`;
    if (map.has(key)) return; // already placed
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      M[matKey] || M.wall
    );
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    map.set(key, { mesh, matKey });
    return mesh;
  }

  function removeBlock(pos) {
    const [x, y, z] = pos;
    const key = `${x},${y},${z}`;
    const entry = placedBlocks.get(key);
    if (!entry) return false;
    scene.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    placedBlocks.delete(key);
    return true;
  }

  function addBlock(pos, matKey) {
    return placeBlock(pos, matKey, M, THREE, scene, placedBlocks);
  }

  function getBlocks() {
    const out = [];
    for (const [key, { matKey }] of placedBlocks) {
      const [x, y, z] = key.split(',').map(Number);
      out.push({ pos: [x, y, z], mat: matKey });
    }
    return out;
  }

  return {
    animate(t) { for (const fn of allAnimated) fn(t); },
    portals: allPortals,
    screens: allScreens,
    addBlock,
    removeBlock,
    getBlocks,
    // Expose for theme switching
    ambient,
    sun,
  };
}
