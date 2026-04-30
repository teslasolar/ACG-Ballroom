// Mount each WallScreen instance as a CSS3DObject — a live HTML iframe
// transformed into 3D space. Tabs in the wrapper swap iframe.src.
//
// Requires global window.THREE.CSS3DRenderer + CSS3DObject (loaded in the
// shim from three.js r128 examples).

const PIX_W = 1024;
const PIX_H = 768;

export function buildScreens({ screens = [], cssScene, THREE }) {
  if (!cssScene || !THREE.CSS3DObject) return { instances: [] };

  const built = [];
  for (const s of screens) {
    const inst = mount(s, THREE);
    cssScene.add(inst.obj);
    built.push(inst);
  }
  return { instances: built };
}

function mount(screen, THREE) {
  const frame = screen.frame || '#bc8cff';
  const glow = screen.glow || frame;
  const wrap = document.createElement('div');
  wrap.className = 'wall-screen';
  Object.assign(wrap.style, {
    width: PIX_W + 'px',
    height: PIX_H + 'px',
    background: '#0d1117',
    border: `4px solid ${frame}`,
    boxShadow: `0 0 60px ${glow}, inset 0 0 20px ${frame}33`,
    fontFamily: "'IBM Plex Mono', monospace",
    color: '#e8f0ff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    pointerEvents: 'auto',
  });

  const tabBar = document.createElement('div');
  Object.assign(tabBar.style, {
    display: 'flex',
    gap: '6px',
    padding: '8px 10px',
    background: '#0b0e16',
    borderBottom: `2px solid ${frame}`,
    minHeight: '46px',
    alignItems: 'center',
  });
  const brand = document.createElement('span');
  brand.textContent = '⌬ KONOMI';
  Object.assign(brand.style, { color: glow, fontWeight: '700', letterSpacing: '2px', marginRight: '12px', fontSize: '14px' });
  tabBar.appendChild(brand);

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { flex: '1', width: '100%', border: 'none', background: '#0d1117' });
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('allow', 'fullscreen');
  iframe.src = (screen.tabs[0] && screen.tabs[0].url) || 'about:blank';

  const buttons = [];
  screen.tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    Object.assign(btn.style, {
      background: i === 0 ? frame : '#1a2030',
      color: i === 0 ? '#0d1117' : frame,
      border: `1px solid ${frame}`,
      padding: '6px 14px',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      fontFamily: 'inherit',
      letterSpacing: '1px',
      borderRadius: '3px',
    });
    btn.onclick = () => {
      iframe.src = tab.url;
      for (const b of buttons) {
        b.style.background = '#1a2030';
        b.style.color = frame;
      }
      btn.style.background = frame;
      btn.style.color = '#0d1117';
    };
    tabBar.appendChild(btn);
    buttons.push(btn);
  });

  wrap.appendChild(tabBar);
  wrap.appendChild(iframe);

  const obj = new THREE.CSS3DObject(wrap);
  obj.position.set(screen.pos[0], screen.pos[1], screen.pos[2]);
  obj.rotation.y = screen.facing || 0;
  const [w, h] = screen.size || [4, 3];
  obj.scale.set(w / PIX_W, h / PIX_H, 1);

  return { screen, obj, wrap, iframe };
}
