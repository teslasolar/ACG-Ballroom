// Ballroom bootstrap. Loads:
//   - the active Ballroom instance JSON
//   - all Equipment instances referenced by the ballroom (for ref<Equipment>)
//   - registers theme bundles (lights on/off)
// Then wires scene + renderer + controls + loop.

import { makeScene, makeMaterials } from '../modules/ballroom/scene.mjs';
import { buildBallroom } from '../modules/ballroom/renderer.mjs';
import { makeControls } from '../modules/ballroom/controls.mjs';
import { startLoop } from '../modules/ballroom/loop.mjs';
import * as theme from '../modules/theme.mjs';

const BALLROOM_URL = 'src/design/instances/ballroom/acg-main.json';
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

  const [ballroom, ...equipmentList] = await Promise.all([
    fetchJson(BALLROOM_URL),
    ...EQUIPMENT_URLS.map(fetchJson),
  ]);

  const equipmentById = new Map();
  for (const eq of equipmentList) equipmentById.set(eq.id, eq);

  const container = document.getElementById('three');
  const { THREE, scene, camera, renderer } = makeScene({
    container,
    bgHex: theme.tokenValue(theme.activeBundle(), '--bg') || '#0d1117',
  });
  const M = makeMaterials(THREE);

  const ballroomRenderer = buildBallroom({ ballroom, equipmentById, THREE, scene, M });

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

  // Hide banner once the user clicks-to-lock
  renderer.domElement.addEventListener('click', () => {
    const b = document.getElementById('banner');
    if (b) b.style.opacity = '0';
  });

  startLoop({
    controls, ballroomRenderer,
    threeRenderer: renderer, scene, camera,
    onHud: ({ dt }) => {
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
