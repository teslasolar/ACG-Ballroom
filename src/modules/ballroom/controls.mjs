// First-person controls: pointer-lock look + WASD move with simple AABB
// collision against scene bounds (hw, hd from renderer.bounds).
// Includes jump (Space) + gravity.
// Returns { state, update(dt), lock() }.

const SPEED = 0.08;
const LOOK  = 0.002;
const GRAVITY = -22;   // m/s²  (downward)
const JUMP_VY =  8;    // m/s   (upward impulse)
const EYE_H   =  2;   // camera eye height above floor

export function makeControls({ THREE, camera, domElement, bounds }) {
  const state = { yaw: 0, pitch: 0, locked: false, vel: new THREE.Vector3(), vy: 0, onGround: true };
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
    const k = e.key.toLowerCase();
    keys[k] = true;
    // Jump impulse on keydown (not held)
    if ((e.key === ' ' || k === ' ') && state.onGround) {
      state.vy = JUMP_VY;
      state.onGround = false;
      e.preventDefault(); // prevent page scroll
    }
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function canMove(x, z) {
    return x > -bounds.hw && x < bounds.hw && z > -bounds.hd && z < bounds.hd;
  }

  function update(dt = 1 / 60) {
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

    // Vertical physics (jump + gravity)
    state.vy += GRAVITY * dt;
    const ny = camera.position.y + state.vy * dt;
    const floor = bounds.floorY !== undefined ? bounds.floorY + EYE_H : EYE_H;
    if (ny <= floor) {
      camera.position.y = floor;
      state.vy = 0;
      state.onGround = true;
    } else {
      camera.position.y = Math.min(ny, (bounds.ceilY !== undefined ? bounds.ceilY : 500) - 0.5);
      state.onGround = false;
    }

    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
  }

  return { state, update };
}
