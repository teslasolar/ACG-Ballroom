// Three.js scene init. Expects a global THREE (loaded via the CDN <script>
// tag in the shim). Returns { THREE, scene, camera, renderer, mount }.

export function makeScene({ container, fog = true, bgHex = '#0d1117', farPlane = 200 }) {
  const T = window.THREE;
  if (!T) throw new Error('THREE global not loaded — include three.js before importing this module');

  const scene = new T.Scene();
  scene.background = new T.Color(bgHex);
  if (fog) scene.fog = new T.FogExp2(bgHex, 0.015);

  const camera = new T.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, farPlane);
  camera.position.set(0, 2, 15);

  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Optional CSS3D layer for live HTML iframes mounted on walls. The
  // CSS3DRenderer ships in three.js examples (loaded from CDN by the shim)
  // and attaches as window.THREE.CSS3DRenderer. We render its scene on top
  // of the WebGL canvas so iframes are clickable and visible.
  let cssRenderer = null, cssScene = null;
  if (T.CSS3DRenderer && T.CSS3DObject) {
    cssRenderer = new T.CSS3DRenderer();
    cssRenderer.setSize(innerWidth, innerHeight);
    Object.assign(cssRenderer.domElement.style, {
      position: 'fixed',
      top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none',
      zIndex: '1',
    });
    container.appendChild(cssRenderer.domElement);
    cssScene = new T.Scene();
  }

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (cssRenderer) cssRenderer.setSize(innerWidth, innerHeight);
  });

  return { THREE: T, scene, camera, renderer, cssRenderer, cssScene };
}

export function makeMaterials(THREE) {
  const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, ...opts });
  return {
    floor:   M(0x161b22, { metalness: 0.1, roughness: 0.8 }),
    wall:    M(0x21262d, { metalness: 0.2, roughness: 0.6 }),
    trim:    M(0xe3b341, { metalness: 0.7, roughness: 0.2, emissive: 0x443300 }),
    pillar:  M(0x30363d, { metalness: 0.4, roughness: 0.3 }),
    glass:   M(0x58a6ff, { metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.15 }),
    anvil:   M(0x484f58, { metalness: 0.8, roughness: 0.3 }),
    ember:   M(0xf57c20, { metalness: 0.2, roughness: 0.4, emissive: 0x662200 }),
  };
}

// Voxel and cylinder helpers; same shape as the legacy file but parametric.
export function vox(scene, THREE, x, y, z, sx, sy, sz, mat, cast = false, recv = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x + sx / 2, y + sy / 2, z + sz / 2);
  if (cast) m.castShadow = true;
  if (recv) m.receiveShadow = true;
  scene.add(m);
  return m;
}

export function cyl(scene, THREE, x, y, z, r, h, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  scene.add(m);
  return m;
}
