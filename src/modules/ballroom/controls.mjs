// First-person controls: pointer-lock look + WASD move with simple AABB
// collision against scene bounds (hw, hd from renderer.bounds).
// Returns { state, update(dt), lock() }.

const SPEED = 0.08;
const LOOK = 0.002;

export function makeControls({ THREE, camera, domElement, bounds }) {
  const state = { yaw: 0, pitch: 0, locked: false, vel: new THREE.Vector3() };
  const keys = Object.create(null);

  domElement.addEventListener('click', () => {
    if (!state.locked) domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === domElement;
  });

  document.addEventListener('mousemove', (e) => {
    if (!state.locked) return;
    state.yaw -= e.movementX * LOOK;
    state.pitch -= e.movementY * LOOK;
    state.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, state.pitch));
  });

  document.addEventListener('keydown', (e) => {
    // Allow chat input to capture keys when focused
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys[e.key.toLowerCase()] = true;
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function canMove(x, z) {
    return x > -bounds.hw && x < bounds.hw && z > -bounds.hd && z < bounds.hd;
  }

  function update() {
    const fwd = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    state.vel.multiplyScalar(0.85);
    if (keys['w']) state.vel.add(fwd.clone().multiplyScalar(SPEED));
    if (keys['s']) state.vel.add(fwd.clone().multiplyScalar(-SPEED));
    if (keys['a']) state.vel.add(right.clone().multiplyScalar(-SPEED));
    if (keys['d']) state.vel.add(right.clone().multiplyScalar(SPEED));

    const nx = camera.position.x + state.vel.x;
    const nz = camera.position.z + state.vel.z;
    if (canMove(nx, nz)) {
      camera.position.x = nx;
      camera.position.z = nz;
    }
    camera.position.y = 2;

    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
  }

  return { state, update };
}
