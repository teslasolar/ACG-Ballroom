// Portal navigation: detects when the camera is within a portal's radius,
// shows a HUD prompt, and on E (or click) routes to the destination.
//
//   destination.kind === 'url'        → window.open or location.href
//   destination.kind === 'ballroom'   → reload with ?ballroom=<id>
//   destination.kind === 'recursive'  → reload with the current ballroom id

const HUD_ID = 'portalHud';

export function attachPortalNav({ camera, portals, currentBallroomId }) {
  let activePortal = null;
  const hud = ensureHud();

  function update() {
    let closest = null, closestDist = Infinity;
    for (const p of portals) {
      const dx = camera.position.x - p.worldPos.x;
      const dz = camera.position.z - p.worldPos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < p.radius && d < closestDist) {
        closest = p; closestDist = d;
      }
    }
    if (closest !== activePortal) {
      activePortal = closest;
      if (activePortal) showPrompt(hud, activePortal.portal);
      else hidePrompt(hud);
    }
  }

  function trigger() {
    if (!activePortal) return;
    navigate(activePortal.portal.destination, currentBallroomId);
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'e' || k === 'enter') trigger();
  });

  // Click-to-enter while pointer is locked: any click while a portal is the
  // active proximity match counts as the trigger.
  document.addEventListener('click', () => {
    if (document.pointerLockElement && activePortal) trigger();
  });

  return { update };
}

function navigate(dest, currentBallroomId) {
  if (!dest) return;
  if (dest.kind === 'url') {
    if (dest.openIn === 'new') window.open(dest.url, '_blank', 'noopener');
    else window.location.href = dest.url;
    return;
  }
  if (dest.kind === 'ballroom') {
    const u = new URL(window.location.href);
    u.searchParams.set('ballroom', dest.ballroomId);
    window.location.href = u.toString();
    return;
  }
  if (dest.kind === 'recursive') {
    const u = new URL(window.location.href);
    u.searchParams.set('ballroom', currentBallroomId);
    u.searchParams.set('r', String(Number(u.searchParams.get('r') || '0') + 1));
    window.location.href = u.toString();
    return;
  }
}

function ensureHud() {
  let el = document.getElementById(HUD_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = HUD_ID;
  Object.assign(el.style, {
    position: 'fixed', left: '50%', bottom: '70px', transform: 'translateX(-50%)',
    zIndex: '4', padding: '8px 14px',
    background: 'rgba(13,17,23,.85)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    font: '11px "IBM Plex Mono", monospace',
    color: '#e8f0ff',
    letterSpacing: '1px',
    pointerEvents: 'none',
    transition: 'opacity .15s',
    opacity: '0',
  });
  document.body.appendChild(el);
  return el;
}

function showPrompt(el, portal) {
  const c = portal.color || '#ffffff';
  el.innerHTML = `<span style="color:${c}">⌬</span> press <kbd style="background:#161b22;border:1px solid #30363d;border-radius:3px;padding:1px 5px">E</kbd> · ${escape(portal.label)}`;
  el.style.opacity = '1';
  el.style.borderColor = c;
}

function hidePrompt(el) { el.style.opacity = '0'; }

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
