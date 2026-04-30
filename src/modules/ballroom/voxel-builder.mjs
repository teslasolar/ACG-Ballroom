// Voxel block placement — Minecraft-style right-click to place, F to remove.
// Uses THREE.Raycaster against all scene meshes.
// Block palette shared with scene materials (M).
//
// API:
//   makeVoxelBuilder({ THREE, scene, camera, M, world, worldRenderer, onBlocksChange })
//   → { update() }   (call every frame to keep raycaster crosshair fresh)

const PALETTE = ['floor', 'wall', 'trim', 'pillar', 'glass', 'anvil', 'ember'];
const REACH = 8; // max placement distance in world units

export function makeVoxelBuilder({ THREE, scene, camera, M, worldRenderer, onBlocksChange }) {
  let selectedSlot = 0;  // 0-indexed into PALETTE
  const raycaster = new THREE.Raycaster();
  raycaster.far = REACH;
  const center2D = new THREE.Vector2(0, 0); // NDC center

  // ── hotbar UI ─────────────────────────────────────────────────────────────
  const hotbar = buildHotbarUI(PALETTE, selectedSlot);

  // ── crosshair ─────────────────────────────────────────────────────────────
  const crosshair = buildCrosshair();

  // ── block highlight ghost ─────────────────────────────────────────────────
  const ghost = new THREE.Mesh(
    new THREE.BoxGeometry(1.01, 1.01, 1.01),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.4 })
  );
  ghost.visible = false;
  scene.add(ghost);

  // ── keyboard: 1-9 select slot, F = remove ─────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const n = parseInt(e.key);
    if (!isNaN(n) && n >= 1 && n <= PALETTE.length) {
      selectedSlot = n - 1;
      refreshHotbar(hotbar, selectedSlot);
    }
    if (e.key.toLowerCase() === 'f') {
      tryRemove();
    }
  });

  // ── right-click to place ───────────────────────────────────────────────────
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    tryPlace();
  });

  // ── helpers ───────────────────────────────────────────────────────────────
  function castRay() {
    raycaster.setFromCamera(center2D, camera);
    const meshes = [];
    scene.traverse((obj) => {
      if (obj.isMesh && obj !== ghost) meshes.push(obj);
    });
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length ? hits[0] : null;
  }

  function snapToGrid(pos) {
    return [Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)];
  }

  function faceOffset(hit) {
    // Shift one unit in the direction of the face normal
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    return [Math.round(n.x), Math.round(n.y), Math.round(n.z)];
  }

  function tryPlace() {
    const hit = castRay();
    if (!hit) return;
    const base = snapToGrid(hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.01)));
    const off = faceOffset(hit);
    const pos = [base[0] + off[0], base[1] + off[1], base[2] + off[2]];
    const matKey = PALETTE[selectedSlot];
    worldRenderer.addBlock(pos, matKey);
    if (onBlocksChange) onBlocksChange(worldRenderer.getBlocks());
  }

  function tryRemove() {
    const hit = castRay();
    if (!hit) return;
    const pos = snapToGrid(hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.01)));
    worldRenderer.removeBlock(pos);
    if (onBlocksChange) onBlocksChange(worldRenderer.getBlocks());
  }

  // ── per-frame update: move ghost to aimed block ───────────────────────────
  function update() {
    const hit = castRay();
    if (hit) {
      const base = snapToGrid(hit.point.clone().sub(hit.face.normal.clone().multiplyScalar(0.01)));
      const off = faceOffset(hit);
      ghost.position.set(base[0] + off[0] + 0.5, base[1] + off[1] + 0.5, base[2] + off[2] + 0.5);
      ghost.visible = true;
    } else {
      ghost.visible = false;
    }
  }

  return { update, hotbar, crosshair };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function buildHotbarUI(palette, selected) {
  const bar = document.createElement('div');
  bar.id = 'hotbar';
  Object.assign(bar.style, {
    position: 'fixed',
    bottom: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '6px',
    zIndex: '30',
    pointerEvents: 'none',
  });

  palette.forEach((matKey, i) => {
    const slot = document.createElement('div');
    slot.dataset.slot = i;
    Object.assign(slot.style, {
      width: '44px',
      height: '44px',
      border: i === selected ? '2px solid #fff' : '2px solid #444',
      borderRadius: '6px',
      background: MAT_COLOR[matKey] || '#333',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '9px',
      fontFamily: 'monospace',
      textShadow: '0 1px 2px #000',
      boxShadow: i === selected ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
    });
    slot.textContent = matKey;
    bar.appendChild(slot);
  });

  document.body.appendChild(bar);
  return bar;
}

function refreshHotbar(bar, selected) {
  const slots = bar.querySelectorAll('div[data-slot]');
  slots.forEach((slot, i) => {
    slot.style.border = i === selected ? '2px solid #fff' : '2px solid #444';
    slot.style.boxShadow = i === selected ? '0 0 8px rgba(255,255,255,0.5)' : 'none';
  });
}

function buildCrosshair() {
  const el = document.createElement('div');
  el.id = 'crosshair';
  Object.assign(el.style, {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '16px',
    height: '16px',
    pointerEvents: 'none',
    zIndex: '25',
  });
  el.innerHTML = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="8" y1="2" x2="8" y2="14" stroke="white" stroke-width="1.5" stroke-opacity="0.75"/>
    <line x1="2" y1="8" x2="14" y2="8" stroke="white" stroke-width="1.5" stroke-opacity="0.75"/>
  </svg>`;
  document.body.appendChild(el);
  return el;
}

// Approximate material display colours for hotbar swatches
const MAT_COLOR = {
  floor:  '#1a1a2e',
  wall:   '#16213e',
  trim:   '#0f3460',
  pillar: '#533483',
  glass:  '#5b8fb9cc',
  anvil:  '#2d2d2d',
  ember:  '#c84b31',
};
