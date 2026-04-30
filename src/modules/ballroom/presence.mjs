// presence.mjs — MQTT-driven multiplayer presence for the ACG world.
//
// Pattern lifted from gateway/kaleidoscope/apps/audiofabric/modules/presence.js
// + mqtt-net.js. Each client publishes its position ~5x/sec on
//   acg/world/<worldId>/players/<name>
// and subscribes to + (every other player). Remote players are rendered as
// a colored aura sphere with a name-label sprite floating above them.
//
// Requires window.mqtt (loaded via CDN in acg_ballroom.html) and THREE.

const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];
const PUBLISH_HZ = 5;            // position updates per second
const STALE_MS   = 10000;        // fade peers we haven't heard from in 10s
const REMOVE_MS  = 30000;        // drop peers entirely after 30s

// Cycle through these aura colors for incoming peers.
const PEER_COLORS = [
  0x4488ff, 0xffa040, 0x40ffa8, 0xff4080, 0xc060ff,
  0xffe040, 0x40e0ff, 0xff8040, 0xa0ff40, 0xff40c0,
];

function hashHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length];
}

function makeLabelSprite(THREE, text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 14, 256, 38);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(4, 1, 1);
  return sp;
}

export function makePresence({ THREE, scene, camera, worldId, playerName }) {
  const topicBase = `acg/world/${worldId}/`;
  const remotes = new Map();   // name → { aura, label, lastSeen, target }
  let client = null;
  let connected = false;
  let publishAccum = 0;
  let state = 'connecting…';

  // ── connect (try brokers in sequence) ───────────────────────────────────
  function tryBroker(idx) {
    if (idx >= BROKERS.length) {
      console.warn('[presence] no MQTT broker reachable; offline mode');
      state = 'offline';
      setStatus(state);
      return;
    }
    if (typeof window.mqtt === 'undefined') {
      console.warn('[presence] window.mqtt missing; offline mode');
      state = 'offline';
      setStatus(state);
      return;
    }
    const cid = `acg_${playerName}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      client = window.mqtt.connect(BROKERS[idx], {
        clientId: cid, clean: true, connectTimeout: 8000,
        reconnectPeriod: 5000, keepalive: 30,
      });
      client.on('connect', () => {
        connected = true;
        state = `online · ${BROKERS[idx].split('//')[1].split(':')[0]}`;
        setStatus(state);
        client.subscribe(topicBase + 'players/+');
      });
      client.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          if (!data || !data.name || data.name === playerName) return;
          handleRemote(data);
        } catch (_) { /* malformed packet */ }
      });
      client.on('error', () => { try { client.end(true); } catch (_) {} ; tryBroker(idx + 1); });
      client.on('offline', () => { state = 'reconnecting…'; setStatus(state); });
    } catch (_) { tryBroker(idx + 1); }
  }
  tryBroker(0);

  function setStatus(s) {
    let el = document.getElementById('presenceStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'presenceStatus';
      Object.assign(el.style, {
        position: 'fixed', top: '14px', right: '14px', zIndex: '20',
        padding: '6px 10px', fontFamily: 'monospace', fontSize: '11px',
        color: '#c9d1d9', background: 'rgba(0,0,0,0.55)',
        border: '1px solid #30363d', borderRadius: '4px', pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.textContent = `[${playerName}] ${s} · ${remotes.size} peer${remotes.size === 1 ? '' : 's'}`;
  }

  // ── handle incoming remote player update ────────────────────────────────
  function handleRemote(data) {
    let r = remotes.get(data.name);
    if (!r) {
      const color = hashHue(data.name);
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 16),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const label = makeLabelSprite(THREE, data.name, '#' + color.toString(16).padStart(6, '0'));
      scene.add(aura); scene.add(label);
      r = {
        aura, label,
        target: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
        lastSeen: Date.now(),
      };
      remotes.set(data.name, r);
      setStatus(state);
    }
    r.target.set(data.x || 0, data.y || 0, data.z || 0);
    r.lastSeen = Date.now();
  }

  // ── periodic publish + interpolate remotes ──────────────────────────────
  function update(dt = 1 / 60) {
    publishAccum += dt;
    if (publishAccum >= 1 / PUBLISH_HZ) {
      publishAccum = 0;
      if (connected && client) {
        const msg = JSON.stringify({
          name: playerName,
          x: +camera.position.x.toFixed(2),
          y: +camera.position.y.toFixed(2),
          z: +camera.position.z.toFixed(2),
          t: Date.now(),
        });
        try { client.publish(topicBase + 'players/' + playerName, msg, { qos: 0 }); }
        catch (_) { /* ignore */ }
      }
    }

    const now = Date.now();
    for (const [name, r] of remotes) {
      const age = now - r.lastSeen;
      if (age > REMOVE_MS) {
        scene.remove(r.aura); scene.remove(r.label);
        r.aura.material.dispose(); r.aura.geometry.dispose();
        r.label.material.map.dispose(); r.label.material.dispose();
        remotes.delete(name);
        setStatus(state);
        continue;
      }
      // smooth lerp toward last reported position
      r.aura.position.lerp(r.target, 0.18);
      r.label.position.set(r.aura.position.x, r.aura.position.y + 1.4, r.aura.position.z);
      const fade = age > STALE_MS ? Math.max(0, 1 - (age - STALE_MS) / (REMOVE_MS - STALE_MS)) : 1;
      r.aura.material.opacity = 0.55 * fade;
      r.label.material.opacity = fade;
    }
  }

  function publishChat(text) {
    if (!connected || !client) return;
    const msg = JSON.stringify({ name: playerName, text, t: Date.now() });
    try { client.publish(topicBase + 'chat', msg, { qos: 0 }); } catch (_) {}
  }

  return { update, publishChat, getPeerCount: () => remotes.size, remotes };
}
