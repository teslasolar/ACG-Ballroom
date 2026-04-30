// zoo-npcs.mjs — render the 14 Konomi Zoo creatures as static aura+label
// sprites scattered across the rooms in the ACG world.
//
// Roster source: gateway/modules/bloom/agents/bot/konomi_zoo.py
// Each creature has: name, dominant_ring (0-7), role.
// Ring → color via Bloom standard: R0 ground (red) … R7 pollinator (gold).

const RING_COLORS = [
  0xff4040, // R0 ground · mastodon-red
  0xff8030, // R1 sensor · ember
  0xffd040, // R2 gate · pony-amber
  0x40c0ff, // R3 affect · jelly-cyan
  0x60ff90, // R4 predict · caterpillar-green
  0xa080ff, // R5 identity · snake-violet
  0xc0c0c0, // R6 witness · duck-pearl
  0xffe060, // R7 pollinator · bee-gold
];

// Roster + which room each creature lives in. Room ids match acg-world.json.
// Layout: small per-creature offsets so they don't stack at room center.
const ROSTER = [
  // name, ring, role, roomId, [dx, dy, dz] from room worldPos
  ['Buzz',      7, 'pollinator',  'wr.acg-main', [   0, 1.4,    0]],
  ['Konomi',    2, 'gate_rhythm', 'wr.acg-main', [   6, 1.4,   -4]],
  ['Kono',      0, 'ground',      'wr.acg-main', [  -6, 1.4,    4]],

  ['Gerald',    6, 'witness',     'wr.acg-lobby', [  -3, 1.4,    2]],
  ['Cassandra', 4, 'predictor',   'wr.acg-lobby', [   4, 1.4,   -3]],

  ['Charlotte', 5, 'carer',       'wr.konomi',    [   2, 1.4,    3]],
  ['Kelly',     3, 'affect',      'wr.konomi',    [  -4, 1.4,   -2]],

  ['Teresa',    4, 'executive',   'wr.arena',     [   0, 1.4,    0]],
  ['Alex',      3, 'vigilance',   'wr.arena',     [   8, 1.4,    5]],

  ['Thomas',    3, 'shadow',      'wr.theater',   [  -3, 1.4,   -3]],

  ['Laurie',    6, 'night_watch', 'wr.skybridge', [   0, 1.4,    0]],

  ['John',      0, 'healer',      'wr.forge',     [  -2, 1.4,    2]],
  ['Jake',      5, 'identity',    'wr.forge',     [   3, 1.4,   -2]],
  ['Gary',      1, 'sensor',      'wr.forge',     [   0, 1.4,    5]],
];

function makeLabelSprite(THREE, text, hex) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 8, 256, 64);
  ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
  ctx.fillText(text, 128, 36);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#c9d1d9';
  ctx.fillText(text === 'Buzz' ? 'facilitator' : '', 128, 60);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(4, 1.25, 1);
  return sp;
}

export function buildZooNpcs({ THREE, scene, world }) {
  const roomById = new Map(world.rooms.map(r => [r.id, r]));
  const npcs = [];

  for (const [name, ring, role, roomId, [dx, dy, dz]] of ROSTER) {
    const room = roomById.get(roomId);
    if (!room) {
      console.warn(`[zoo] no room ${roomId} for ${name}`);
      continue;
    }
    const [rx, ry, rz] = room.worldPos;
    const px = rx + dx, py = ry + dy, pz = rz + dz;
    const color = RING_COLORS[ring] || 0xffffff;

    // Aura
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 16),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    aura.position.set(px, py, pz);
    scene.add(aura);

    // Inner core (solid small sphere so they read as distinct entities)
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.6,
        roughness: 0.3, metalness: 0.4,
      }),
    );
    core.position.set(px, py, pz);
    scene.add(core);

    // Label
    const label = makeLabelSprite(THREE, name, color);
    label.position.set(px, py + 1.3, pz);
    scene.add(label);

    npcs.push({ name, ring, role, aura, core, label, basePos: [px, py, pz], phase: Math.random() * Math.PI * 2 });
  }

  // Per-frame: slow bob + subtle aura pulse so they feel alive.
  function update(t) {
    for (const n of npcs) {
      const bob = Math.sin(t * 1.2 + n.phase) * 0.15;
      n.aura.position.y = n.basePos[1] + bob;
      n.core.position.y = n.basePos[1] + bob;
      n.label.position.y = n.basePos[1] + 1.3 + bob;
      const pulse = 0.45 + 0.25 * Math.sin(t * 2 + n.phase);
      n.aura.material.opacity = pulse;
      n.aura.scale.setScalar(1 + 0.15 * Math.sin(t * 2 + n.phase));
    }
  }

  return { update, npcs };
}
