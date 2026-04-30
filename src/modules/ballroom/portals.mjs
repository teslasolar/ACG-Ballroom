// Portal renderer: builds arch geometry + flaming "super-saiyan" aura per
// Portal UDT instance. Arch shape and flame preset are templated — the
// caller passes the validated portal object and the renderer dispatches.

const FLAME_PRESETS = {
  none:    { count:  0, rise: 0,    spark: 0, intensity: 0,   life: 1.0 },
  low:     { count: 12, rise: 0.6,  spark: 0, intensity: 0.6, life: 1.4 },
  medium:  { count: 24, rise: 0.9,  spark: 4, intensity: 1.0, life: 1.6 },
  saiyan:  { count: 40, rise: 1.6,  spark: 8, intensity: 2.0, life: 1.2 },
  nova:    { count: 48, rise: 2.0,  spark: 12,intensity: 3.0, life: 1.0 },
};

export function buildPortals({ portals = [], THREE, scene }) {
  const built = [];

  for (const portal of portals) {
    const inst = buildOne(portal, THREE, scene);
    if (inst) built.push(inst);
  }

  return {
    instances: built,
    animate(t) { for (const p of built) p.animate(t); },
  };
}

function buildOne(portal, THREE, scene) {
  const scale = portal.scale ?? 1.0;
  const root = new THREE.Group();
  root.position.set(portal.pos[0], portal.pos[1], portal.pos[2]);
  root.rotation.y = portal.facing ?? 0;
  scene.add(root);

  const color = new THREE.Color(portal.color);
  const secondary = portal.secondary ? new THREE.Color(portal.secondary) : color.clone().lerp(new THREE.Color(0xffffff), 0.4);

  buildArch(portal.arch, scale, color, secondary, THREE, root);

  // Floor disc — same primary color, ~translucent, marks the portal hot zone
  const disc = new THREE.Mesh(
    new THREE.RingGeometry(0.4 * scale, 1.4 * scale, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  root.add(disc);

  // Floating label sprite (canvas → texture)
  const label = makeLabelSprite(portal.label, color, THREE);
  label.position.set(0, 3.6 * scale, 0);
  root.add(label);

  // Flame particles
  const flameTick = buildFlame(portal.flame || 'medium', scale, color, secondary, THREE, root);

  // Convenience: a non-rotated world-space anchor for proximity checks
  const worldPos = new THREE.Vector3(portal.pos[0], portal.pos[1] + 1.4, portal.pos[2]);

  return {
    portal,
    root,
    worldPos,
    radius: 2.5 * scale,
    animate(t) {
      flameTick(t);
      label.material.rotation = Math.sin(t * 0.8) * 0.04;
      disc.material.opacity = 0.25 + Math.sin(t * 2) * 0.08;
    },
  };
}

function buildArch(shape, s, color, secondary, THREE, root) {
  const matFrame = new THREE.MeshStandardMaterial({
    color, metalness: 0.7, roughness: 0.2, emissive: color, emissiveIntensity: 0.6,
  });
  const matInner = new THREE.MeshBasicMaterial({
    color: secondary, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
  });

  switch (shape) {
    case 'gothic': {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(1.2 * s, 0.12 * s, 8, 24, Math.PI),
        matFrame,
      );
      torus.position.y = 1.5 * s;
      torus.rotation.x = 0;
      torus.rotation.z = 0;
      // pinch top to give it a pointed look
      torus.scale.set(1, 1.4, 1);
      root.add(torus);
      // legs
      addLeg(-1.2 * s, 1.5 * s, 0.12 * s, matFrame, THREE, root);
      addLeg( 1.2 * s, 1.5 * s, 0.12 * s, matFrame, THREE, root);
      // inner pane
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.0 * s, 2.4 * s), matInner);
      pane.position.y = 1.5 * s;
      root.add(pane);
      break;
    }
    case 'round': {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(1.2 * s, 0.1 * s, 8, 32, Math.PI),
        matFrame,
      );
      torus.position.y = 1.4 * s;
      root.add(torus);
      addLeg(-1.2 * s, 1.4 * s, 0.1 * s, matFrame, THREE, root);
      addLeg( 1.2 * s, 1.4 * s, 0.1 * s, matFrame, THREE, root);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * s, 2.4 * s), matInner);
      pane.position.y = 1.4 * s;
      root.add(pane);
      break;
    }
    case 'cube': {
      // Wireframe-ish cube made of 12 thin box edges
      const edge = (sx, sy, sz, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), matFrame);
        m.position.set(x, y, z);
        root.add(m);
      };
      const a = 1.2 * s, h = 2.4 * s, t = 0.08 * s, y0 = h / 2;
      // verticals
      edge(t, h, t,  -a, y0, -a);
      edge(t, h, t,   a, y0, -a);
      edge(t, h, t,  -a, y0,  a);
      edge(t, h, t,   a, y0,  a);
      // top horizontals
      edge(2 * a, t, t,  0, h, -a);
      edge(2 * a, t, t,  0, h,  a);
      edge(t, t, 2 * a, -a, h,  0);
      edge(t, t, 2 * a,  a, h,  0);
      // bottom horizontals
      edge(2 * a, t, t,  0, 0, -a);
      edge(2 * a, t, t,  0, 0,  a);
      edge(t, t, 2 * a, -a, 0,  0);
      edge(t, t, 2 * a,  a, 0,  0);
      // inner glow plane
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2 * a, h), matInner);
      pane.position.y = h / 2;
      root.add(pane);
      break;
    }
    case 'toroidal': {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.4 * s, 0.18 * s, 12, 48),
        matFrame,
      );
      ring.position.y = 1.6 * s;
      ring.rotation.x = Math.PI / 2;
      root.add(ring);
      const pane = new THREE.Mesh(new THREE.CircleGeometry(1.3 * s, 32), matInner);
      pane.position.y = 1.6 * s;
      pane.rotation.y = Math.PI / 2; // face forward
      root.add(pane);
      break;
    }
    case 'trapezoid': {
      // 4 framed edges with a sloped top
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 0.12 * s, 0.12 * s), matFrame);
      top.position.set(0, 2.6 * s, 0);
      root.add(top);
      const bot = new THREE.Mesh(new THREE.BoxGeometry(2.4 * s, 0.12 * s, 0.12 * s), matFrame);
      bot.position.set(0, 0.06 * s, 0);
      root.add(bot);
      // angled sides
      for (const sign of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 2.7 * s, 0.12 * s), matFrame);
        side.position.set(sign * 1.0 * s, 1.35 * s, 0);
        side.rotation.z = sign * 0.18;
        root.add(side);
      }
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.8 * s, 2.5 * s), matInner);
      pane.position.set(0, 1.3 * s, 0);
      root.add(pane);
      break;
    }
  }
}

function addLeg(x, top, t, mat, THREE, root) {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(t * 1.5, top, t * 1.5), mat);
  leg.position.set(x, top / 2, 0);
  root.add(leg);
}

function buildFlame(presetName, scale, color, secondary, THREE, root) {
  const preset = FLAME_PRESETS[presetName] || FLAME_PRESETS.medium;
  if (preset.count === 0) return () => {};

  const particles = [];
  const sparkles = [];
  const baseRadius = 1.3 * scale;

  for (let i = 0; i < preset.count; i++) {
    const a = (i / preset.count) * Math.PI * 2;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.32 * scale, 5), mat);
    const r = baseRadius + (Math.random() - 0.5) * 0.2;
    m.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    m.userData = { angle: a, baseR: r, life: Math.random() * preset.life, seed: Math.random() };
    root.add(m);
    particles.push(m);
  }

  for (let i = 0; i < preset.spark; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: secondary });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 * scale), mat);
    m.userData = { phase: Math.random() * Math.PI * 2, radius: baseRadius * 1.05, height: 0.5 + Math.random() * 2.0 };
    root.add(m);
    sparkles.push(m);
  }

  // PointLight breathing with the flame
  const flameLight = new THREE.PointLight(color, preset.intensity, 6 * scale);
  flameLight.position.set(0, 1.2 * scale, 0);
  root.add(flameLight);

  return function tick(t) {
    for (const p of particles) {
      const u = p.userData;
      u.life += 0.02;
      const phase = (u.life % preset.life) / preset.life; // 0..1
      const y = phase * preset.rise * 2.4 * scale;
      const fade = 1 - phase;
      p.position.y = 0.05 + y;
      p.scale.setScalar(0.6 + Math.sin(phase * Math.PI) * 0.6);
      p.material.opacity = 0.85 * fade;
      // Color drift toward secondary as the particle rises
      p.material.color.copy(color).lerp(secondary, phase * 0.7);
      // Wobble in/out
      const r = u.baseR + Math.sin(t * 4 + u.seed * 6) * 0.05 * scale;
      p.position.x = Math.cos(u.angle + t * 0.3) * r;
      p.position.z = Math.sin(u.angle + t * 0.3) * r;
    }
    for (const s of sparkles) {
      const u = s.userData;
      const a = t * 1.5 + u.phase;
      s.position.set(Math.cos(a) * u.radius, u.height + Math.sin(t * 3 + u.phase) * 0.2, Math.sin(a) * u.radius);
      s.material.color.copy(secondary).offsetHSL(Math.sin(t * 2 + u.phase) * 0.05, 0, 0);
    }
    flameLight.intensity = preset.intensity * (0.7 + Math.sin(t * 6) * 0.3);
  };
}

function makeLabelSprite(text, color, THREE) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.font = '700 36px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = `#${color.getHexString()}`;
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 0.75, 1);
  return sprite;
}
