// Ballroom bootstrap. Loads:
//   - the active Ballroom instance JSON (selected via ?ballroom=<id>)
//   - all Equipment instances referenced by the ballroom (ref<Equipment>)
//   - registers theme bundles (lights on/off)
// Then wires scene + renderer + controls + loop + portal navigation.

import { makeScene, makeMaterials } from '../modules/ballroom/scene.mjs';
import { buildBallroom } from '../modules/ballroom/renderer.mjs';
import { makeControls } from '../modules/ballroom/controls.mjs';
import { startLoop } from '../modules/ballroom/loop.mjs';
import { attachPortalNav } from '../modules/ballroom/portal-nav.mjs';
import * as theme from '../modules/theme.mjs';

// Map of ballroom id → JSON path. Add new ballrooms here as they land.
const BALLROOM_REGISTRY = {
  'br.acg-main':  'src/design/instances/ballroom/acg-main.json',
  'br.acg-lobby': 'src/design/instances/ballroom/acg-lobby.json',
  'br.konomi':    'src/design/instances/ballroom/acg-konomi.json',
};
const DEFAULT_BALLROOM = 'br.acg-main';

const EQUIPMENT_URLS = [
  'src/design/instances/equipment/tk101-m1.json',
  'src/design/instances/equipment/p101.json',
];

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`fetch failed (${r.status}): ${url}`);
  return r.json();
}

async function main() {
  // Themes first so the page paints in the chosen scheme before three boots.
  await theme.loadBundleFromUrl('src/design/instances/themes/dark.json');
  await theme.loadBundleFromUrl('src/design/instances/themes/light.json');
  theme.restoreOrApply('theme.dark');

  const params = new URLSearchParams(window.location.search);
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
