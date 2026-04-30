// Ballroom bootstrap. Loads:
//   - the active Ballroom instance JSON (selected via ?ballroom=<id>)  OR
//   - a World instance JSON (selected via ?world=<id>) for multi-room mode
//   - all Equipment instances referenced by the ballroom (ref<Equipment>)
//   - registers theme bundles (lights on/off)
// Then wires scene + renderer + controls + loop + portal navigation.
//
// World mode URL:  ?world=world.acg
// Ballroom mode:   ?ballroom=br.acg-main  (default)

import { makeScene, makeMaterials } from '../modules/ballroom/scene.mjs';
import { buildBallroom } from '../modules/ballroom/renderer.mjs';
import { buildWorld } from '../modules/ballroom/world-renderer.mjs';
import { makeControls } from '../modules/ballroom/controls.mjs';
import { startLoop } from '../modules/ballroom/loop.mjs';
import { attachPortalNav } from '../modules/ballroom/portal-nav.mjs';
import { makeVoxelBuilder } from '../modules/ballroom/voxel-builder.mjs';
import * as theme from '../modules/theme.mjs';

// Map of ballroom id → JSON path. Add new ballrooms here as they land.
const BALLROOM_REGISTRY = {
  'br.acg-main':  'src/design/instances/ballroom/acg-main.json',
  'br.acg-lobby': 'src/design/instances/ballroom/acg-lobby.json',
  'br.konomi':    'src/design/instances/ballroom/acg-konomi.json',
};
const DEFAULT_BALLROOM = 'br.acg-main';

// Map of world id → JSON path.
const WORLD_REGISTRY = {
  'world.acg': 'src/design/instances/world/acg-world.json',
};

// Map of template id → JSON path.
const TEMPLATE_REGISTRY = {
  'template.arena':   'src/design/instances/templates/arena.json',
  'template.theater': 'src/design/instances/templates/theater.json',
  'template.bridge':  'src/design/instances/templates/bridge.json',
  'template.forge':   'src/design/instances/templates/forge.json',
};

const EQUIPMENT_URLS = [
  'src/design/instances/equipment/tk101-m1.json',
  'src/design/instances/equipment/p101.json',
];

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`fetch failed (${r.status}): ${url}`);
  return r.json();
}

// ─── minimap HUD (top-down 2D canvas) ────────────────────────────────────────
function buildMinimap(world, roomPosFn) {
  const SIZE = 140;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.id = 'minimap';
  Object.assign(canvas.style, {
    position: 'fixed',
    bottom: '80px',
    right: '14px',
    width: SIZE + 'px',
    height: SIZE + 'px',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid #334',
    borderRadius: '8px',
    zIndex: '20',
    pointerEvents: 'none',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // World spans ±500 → map to ±SIZE/2
  const SCALE = SIZE / 1000;
  const CX = SIZE / 2, CY = SIZE / 2;

  function draw(cameraPos) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Rooms
    for (const wr of world.rooms) {
      const [wx, , wz] = wr.worldPos;
      const sx = CX + wx * SCALE;
      const sz = CY + wz * SCALE;
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(sx - 4, sz - 4, 8, 8);
      ctx.fillStyle = '#58a6ff';
      ctx.font = '6px monospace';
      ctx.fillText(wr.name.slice(0, 8), sx + 5, sz + 2);
    }
    // Player dot
    if (cameraPos) {
      const px = CX + cameraPos.x * SCALE;
      const pz = CY + cameraPos.z * SCALE;
      ctx.fillStyle = '#ffd050';
      ctx.beginPath();
      ctx.arc(px, pz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { draw };
}

async function mainWorld(params) {
  const worldId = params.get('world');
  const worldUrl = WORLD_REGISTRY[worldId];
  if (!worldUrl) throw new Error(`Unknown world id: ${worldId}`);

  await theme.loadBundleFromUrl('src/design/instances/themes/dark.json');
  await theme.loadBundleFromUrl('src/design/instances/themes/light.json');
  theme.restoreOrApply('theme.dark');

  const world = await fetchJson(worldUrl);

  // Gather which templateIds are ballrooms vs room templates
  const ballroomIds = new Set(Object.keys(BALLROOM_REGISTRY));
  const templateIds = new Set(Object.keys(TEMPLATE_REGISTRY));
  const neededBallrooms = world.rooms.filter(wr => ballroomIds.has(wr.templateId));
  const neededTemplates = world.rooms.filter(wr => templateIds.has(wr.templateId));

  const [
    ...fetchedBallrooms
  ] = await Promise.all([
    ...neededBallrooms.map(wr => fetchJson(BALLROOM_REGISTRY[wr.templateId])),
  ]);
  const [
    ...fetchedTemplates
  ] = await Promise.all([
    ...neededTemplates.map(wr => fetchJson(TEMPLATE_REGISTRY[wr.templateId])),
  ]);

  const ballroomMap = new Map();
  neededBallrooms.forEach((wr, i) => ballroomMap.set(wr.templateId, fetchedBallrooms[i]));

  const templateMap = new Map();
  neededTemplates.forEach((wr, i) => templateMap.set(wr.templateId, fetchedTemplates[i]));

  console.log(`[world] loaded ${world.id} "${world.name}" with ${world.rooms.length} rooms`);

  const container = document.getElementById('three');
  const { THREE, scene, camera, renderer, cssRenderer, cssScene } = makeScene({
    container,
    fog: false,
    bgHex: world.skyHex || '#0d1117',
    farPlane: 2000,
  });
  const M = makeMaterials(THREE);

  // Fog for depth cue
  if (world.fogDensity) {
    scene.fog = new THREE.FogExp2(new THREE.Color(world.skyHex || '#0d1117'), world.fogDensity);
  }

  const worldRenderer = buildWorld({ world, templateMap, ballroomMap, THREE, scene, M, cssScene });

  const themeBtn = document.getElementById('themeBt');
  if (themeBtn) {
    themeBtn.onclick = () => theme.toggle();
  }

  // Spawn camera at world spawn
  if (world.spawn) camera.position.set(world.spawn[0], world.spawn[1], world.spawn[2]);

  const roomEl = document.getElementById('room');
  if (roomEl) roomEl.textContent = world.name || world.id;

  renderer.domElement.addEventListener('click', () => {
    const b = document.getElementById('banner');
    if (b) b.style.opacity = '0';
  });

  // Wide-open world: no AABB bounds needed (use ±490 sky-dome radius)
  const controls = makeControls({
    THREE, camera,
    domElement: renderer.domElement,
    bounds: { hw: 490, hd: 490, floorY: 0, ceilY: 250 },
  });

  // Voxel builder (right-click place, F remove, 1-9 hotbar)
  const voxelBuilder = makeVoxelBuilder({
    THREE, scene, camera, M,
    worldRenderer,
    onBlocksChange(blocks) {
      // Persist placed blocks to localStorage so they survive page reload
      try { localStorage.setItem('acg_world_blocks_' + world.id, JSON.stringify(blocks)); }
      catch (_) { /* quota exceeded — ignore */ }
    },
  });

  // Restore persisted blocks
  try {
    const saved = localStorage.getItem('acg_world_blocks_' + world.id);
    if (saved) {
      for (const blk of JSON.parse(saved)) worldRenderer.addBlock(blk.pos, blk.mat);
    }
  } catch (_) { /* ignore */ }

  // Minimap
  const minimap = buildMinimap(world, () => camera.position);

  const portalNav = attachPortalNav({
    camera,
    portals: worldRenderer.portals,
    currentBallroomId: world.id,
  });

  startLoop({
    controls,
    ballroomRenderer: {
      animate: worldRenderer.animate.bind(worldRenderer),
      applyTheme: () => {},
      portals: worldRenderer.portals,
      screens: worldRenderer.screens,
      bounds: { hw: 490, hd: 490 },
    },
    threeRenderer: renderer, scene, camera,
    cssRenderer, cssScene,
    onHud: ({ dt }) => {
      portalNav.update();
      voxelBuilder.update();
      minimap.draw(camera.position);
      const fps = document.getElementById('fps');
      if (fps) fps.textContent = Math.round(1 / dt) + ' fps';
      const pos = document.getElementById('pos');
      if (pos) pos.textContent = `x:${camera.position.x.toFixed(1)} y:${camera.position.y.toFixed(1)} z:${camera.position.z.toFixed(1)}`;
    },
  });
}

async function main() {
  const params = new URLSearchParams(window.location.search);

  // World mode: ?world=<id>
  if (params.has('world')) {
    return mainWorld(params);
  }

  // ── Classic ballroom mode ─────────────────────────────────────────────────
  // Themes first so the page paints in the chosen scheme before three boots.
  await theme.loadBundleFromUrl('src/design/instances/themes/dark.json');
  await theme.loadBundleFromUrl('src/design/instances/themes/light.json');
  theme.restoreOrApply('theme.dark');

  const wantId = params.get('ballroom') || DEFAULT_BALLROOM;
  const ballroomUrl = BALLROOM_REGISTRY[wantId] || BALLROOM_REGISTRY[DEFAULT_BALLROOM];

  const [ballroom, ...equipmentList] = await Promise.all([
    fetchJson(ballroomUrl),
    ...EQUIPMENT_URLS.map(fetchJson),
  ]);

  const equipmentById = new Map();
  for (const eq of equipmentList) equipmentById.set(eq.id, eq);

  console.log(`[ballroom] loaded ${ballroom.id} "${ballroom.name}"`);
  console.log(`  rooms=${(ballroom.rooms || []).length}`,
              `portals=${(ballroom.portals || []).length}`,
              `screens=${(ballroom.screens || []).length}`,
              `css3d=${typeof window.THREE?.CSS3DRenderer === 'function'}`);
  if (ballroom.portals) {
    for (const p of ballroom.portals) {
      console.log(`  · portal ${p.id} @ [${p.pos.join(',')}] → ${p.destination.kind}:${p.destination.url || p.destination.ballroomId || ''}`);
    }
  }

  const container = document.getElementById('three');
  const { THREE, scene, camera, renderer, cssRenderer, cssScene } = makeScene({
    container,
    bgHex: theme.tokenValue(theme.activeBundle(), '--bg') || '#0d1117',
  });
  const M = makeMaterials(THREE);

  const ballroomRenderer = buildBallroom({ ballroom, equipmentById, THREE, scene, M, cssScene });

  // Push the active theme into the scene immediately, then re-apply on every
  // toggle so 'lights on' actually flattens the world (no fog, no shadows,
  // ambient blasted, materials self-emit).
  const applyActive = () => ballroomRenderer.applyTheme(theme.activeBundle());
  applyActive();
  theme.onChange(applyActive);

  const themeBtn = document.getElementById('themeBt');
  if (themeBtn) {
    themeBtn.onclick = () => theme.toggle();
    const reflect = (b) => { themeBtn.title = b.scheme === 'light' ? 'Lights off' : 'Lights on'; };
    reflect(theme.activeBundle());
    theme.onChange(reflect);
  }

  const controls = makeControls({
    THREE, camera,
    domElement: renderer.domElement,
    bounds: ballroomRenderer.bounds,
  });

  // Spawn the camera where the ballroom asks
  if (ballroom.spawn) camera.position.set(ballroom.spawn[0], ballroom.spawn[1], ballroom.spawn[2]);

  // Surface the active ballroom name in the HUD
  const roomEl = document.getElementById('room');
  if (roomEl) roomEl.textContent = ballroom.name || ballroom.id;

  // Hide banner once the user clicks-to-lock
  renderer.domElement.addEventListener('click', () => {
    const b = document.getElementById('banner');
    if (b) b.style.opacity = '0';
  });

  // Portal proximity + navigation
  const portalNav = attachPortalNav({
    camera,
    portals: ballroomRenderer.portals,
    currentBallroomId: ballroom.id,
  });

  startLoop({
    controls, ballroomRenderer,
    threeRenderer: renderer, scene, camera,
    cssRenderer, cssScene,
    onHud: ({ dt }) => {
      portalNav.update();
      const fps = document.getElementById('fps');
      if (fps) fps.textContent = Math.round(1 / dt) + ' fps';
      const pos = document.getElementById('pos');
      if (pos) pos.textContent = `x:${camera.position.x.toFixed(1)} z:${camera.position.z.toFixed(1)}`;
    },
  });
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#f85149;padding:24px;font:12px monospace">${err.stack || err.message}</pre>`;
});
