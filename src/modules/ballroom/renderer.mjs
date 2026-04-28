// Walk a Ballroom UDT instance and populate a three.js scene.
//
// Inputs:
//   - ballroom: validated Ballroom instance (with rooms[], each with bbox, kind,
//     optional subRooms[], optional equipment refs)
//   - equipmentById: Map<string, Equipment instance> for ref<Equipment> lookup
//   - { THREE, scene, M }: from scene.mjs
//
// Returns { animate(t), bounds } so the loop can update animated bits.

import { vox, cyl } from './scene.mjs';

export function buildBallroom({ ballroom, equipmentById, THREE, scene, M }) {
  const animated = [];
  const bounds = computeBounds(ballroom);

  // Outer floor + ceiling derived from ballroom.size = [W, H, D]
  const [W, H, D] = ballroom.size;
  vox(scene, THREE, -W / 2, -0.1, -D / 2, W, 0.1, D, M.floor, false, true);
  vox(scene, THREE, -W / 2,  H,  -D / 2, W, 0.3, D, M.wall, false, false);

  // Outer walls (entrance gap on +Z front, like the legacy file)
  vox(scene, THREE, -W / 2,    0, -D / 2, 0.4, H, D,  M.wall, true, true);
  vox(scene, THREE,  W / 2 - 0.4, 0, -D / 2, 0.4, H, D,  M.wall, true, true);
  vox(scene, THREE, -W / 2,    0, -D / 2, W,   H, 0.4, M.wall, true, true);
  vox(scene, THREE, -W / 2,    0,  D / 2 - 0.4, W / 2 - 3, H, 0.4, M.wall, true, true);
  vox(scene, THREE,  3,        0,  D / 2 - 0.4, W / 2 - 3, H, 0.4, M.wall, true, true);
  vox(scene, THREE, -3,        H - 2, D / 2 - 0.4, 6, 2, 0.4, M.wall, true, true);

  // Pillars row (independent of room boundaries — structural)
  for (let i = 0; i < 6; i++) {
    const z = -D / 2 + 4 + i * (D - 8) / 5;
    cyl(scene, THREE, -W / 2 + 2, 0, z, 0.4, H, M.pillar);
    cyl(scene, THREE,  W / 2 - 2, 0, z, 0.4, H, M.pillar);
  }

  // Recurse into each Room (and subRooms)
  for (const room of ballroom.rooms || []) {
    addRoom(room, { THREE, scene, M, animated, equipmentById });
  }

  // Lighting
  scene.add(new THREE.AmbientLight(0x161b22, 0.6));
  const dl = new THREE.DirectionalLight(0xffeedd, 0.4);
  dl.position.set(5, H - 1, 5);
  dl.castShadow = true;
  dl.shadow.mapSize.width = dl.shadow.mapSize.height = 1024;
  scene.add(dl);

  return {
    animate(t) { for (const fn of animated) fn(t); },
    bounds,
  };
}

function computeBounds(ballroom) {
  const [W, , D] = ballroom.size;
  return { hw: W / 2 - 0.8, hd: D / 2 - 0.8 };
}

function addRoom(room, ctx) {
  const { THREE, scene, M, animated, equipmentById } = ctx;
  if (!room.bbox || room.bbox.length !== 6) return;
  const [x1, y1, z1, x2, y2, z2] = room.bbox;
  const sx = x2 - x1, sy = y2 - y1, sz = z2 - z1;

  switch (room.kind) {
    case 'stage': {
      vox(scene, THREE, x1,    y1,        z1, sx, 0.6, sz,   M.pillar, true, true);
      vox(scene, THREE, x1,    y1 + 0.6,  z1, sx, 0.05, sz,  M.trim);
      // Hanging hammer: animated rotation
      const hammer = new THREE.Group();
      hammer.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), M.trim));
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), M.pillar);
      handle.position.y = -0.6;
      hammer.add(handle);
      hammer.position.set((x1 + x2) / 2, y1 + 3.2, (z1 + z2) / 2 + 0.5);
      scene.add(hammer);
      animated.push((t) => {
        hammer.position.y = y1 + 3.2 + Math.sin(t * 1.5) * 0.3;
        hammer.rotation.y = t * 0.5;
        hammer.rotation.z = Math.sin(t * 2) * 0.15;
      });
      break;
    }
    case 'forge': {
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      cyl(scene, THREE, cx, 0.1, cz, 1.2, 0.4, M.anvil);
      const fire = new THREE.PointLight(0xff6622, 2, 12);
      fire.position.set(cx, 1.5, cz);
      scene.add(fire);
      const embers = [];
      for (let i = 0; i < 20; i++) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), M.ember.clone());
        e.position.set(cx + Math.random() * 2 - 0.5, 1 + Math.random() * 2, cz + Math.random() * 2 - 1);
        scene.add(e);
        embers.push({ mesh: e, vy: 0.01 + Math.random() * 0.02, base: e.position.clone() });
      }
      animated.push((t) => {
        fire.intensity = 1.5 + Math.sin(t * 8) * 0.5 + Math.sin(t * 13) * 0.3;
        fire.color.setHSL(0.06 + Math.sin(t * 5) * 0.02, 1, 0.5);
        for (const e of embers) {
          e.mesh.position.y += e.vy;
          e.mesh.position.x += Math.sin(t * 2 + e.base.x * 10) * 0.005;
          e.mesh.rotation.x = t * 2; e.mesh.rotation.z = t;
          if (e.mesh.position.y > e.base.y + 3) {
            e.mesh.position.y = e.base.y;
            e.mesh.position.x = e.base.x + Math.random() - 0.5;
          }
          e.mesh.material.emissive.setHSL(0.08 + Math.sin(t + e.base.x) * 0.03, 1, 0.2 + Math.sin(t * 3 + e.base.z) * 0.1);
        }
      });
      break;
    }
    case 'annex': {
      // Used for the chandelier sub-room
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const group = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.08, 6, 24), M.trim);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), M.trim);
        candle.position.set(Math.cos(a) * 3, 0.15, Math.sin(a) * 3);
        group.add(candle);
        const flame = new THREE.PointLight(0xffaa44, 0.3, 6);
        flame.position.copy(candle.position);
        flame.position.y += 0.3;
        group.add(flame);
      }
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2, 4), M.pillar);
      chain.position.y = 1;
      group.add(chain);
      group.position.set(cx, y1 - 0.5, cz);
      scene.add(group);
      animated.push((t) => {
        group.rotation.z = Math.sin(t * 0.3) * 0.02;
        group.rotation.x = Math.sin(t * 0.4) * 0.01;
      });
      break;
    }
    case 'entrance':
      // entrance is structural — gap in the front wall handles itself
      break;
    case 'hall':
    default:
      // Floor inlay: gold trim outlining the bbox
      vox(scene, THREE, x1, 0.01, z1, sx,   0.05, 0.15, M.trim);
      vox(scene, THREE, x1, 0.01, z2 - 0.15, sx, 0.05, 0.15, M.trim);
      vox(scene, THREE, x1, 0.01, z1, 0.15, 0.05, sz,   M.trim);
      vox(scene, THREE, x2 - 0.15, 0.01, z1, 0.15, 0.05, sz, M.trim);
  }

  // Equipment placed in this room (refs into equipmentById)
  for (const eqId of room.equipment || []) {
    const eq = typeof eqId === 'string' ? equipmentById?.get(eqId) : eqId;
    if (!eq || !eq.pos) continue;
    placeEquipment(eq, ctx);
  }

  // Recurse into subRooms
  for (const sub of room.subRooms || []) addRoom(sub, ctx);
}

function placeEquipment(eq, ctx) {
  const { THREE, scene, M } = ctx;
  const [x, y, z] = eq.pos;
  switch (eq.geom) {
    case 'anvil': {
      vox(scene, THREE, x - 1,    y,         z - 0.75, 2, 0.8, 1.5, M.anvil, true, false);
      vox(scene, THREE, x - 1.3,  y + 0.8,   z - 1,    2.6, 0.3, 2,   M.anvil, true, false);
      const horn = cyl(scene, THREE, x + 2, y + 0.95, z - 0.3, 0.15, 0.8, M.anvil);
      horn.rotation.z = Math.PI / 2;
      break;
    }
    case 'fire': {
      cyl(scene, THREE, x, y + 0.1, z, 1.0, 0.4, M.anvil);
      break;
    }
    case 'cyl':
      cyl(scene, THREE, x, y, z, 0.5, 1.0, M.pillar);
      break;
    case 'box':
    default:
      vox(scene, THREE, x - 0.5, y, z - 0.5, 1, 1, 1, M.pillar, true, false);
  }
}
