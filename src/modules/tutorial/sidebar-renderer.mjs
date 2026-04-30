// Sidebar renderers for the Ignition tutorial app. Left holds the step tree,
// the current step's UDT view, and the prereq list. Right holds the active
// step's CONFIG / KEY / MISTAKES blocks. Static PORTS and ARCHITECTURE
// sections live in the HTML.

export function renderLeft({ steps, current, mounts, onJump }) {
  if (mounts.tree) {
    mounts.tree.innerHTML = steps.map((s, i) => {
      const done = i < current.index;
      const active = i === current.index;
      const dot = active ? 'var(--ig)' : done ? 'var(--ok)' : 'var(--t2)';
      return `<div class="ri${active ? ' on' : ''}${done ? ' done' : ''}" data-i="${i}">
        <span class="dot" style="background:${dot}"></span>
        <span class="o">${i + 1}</span> ${esc(s.title)}
      </div>`;
    }).join('');
    if (onJump) {
      mounts.tree.querySelectorAll('.ri').forEach((el) => {
        el.onclick = () => onJump(Number(el.dataset.i));
      });
    }
  }

  if (mounts.udt) {
    mounts.udt.innerHTML = [
      kv('type', 'TutorialStep'),
      kv('id', current.id, 'v'),
      kv('phase', current.phase, 'o'),
      kv('title', current.title, 'g'),
      kv('prereqs', String((current.prereqs || []).length), 'v'),
      kv('keys', String((current.key || []).length), 'v'),
      kv('mistakes', String((current.mistakes || []).length), 'w'),
    ].join('');
  }

  if (mounts.prereqs) {
    const list = current.prereqs || [];
    mounts.prereqs.innerHTML = list.length === 0
      ? '<span class="d">None</span>'
      : list.map((p) => `<div style="font-size:6.5px;padding:1px 0;color:var(--ig)">→ ${esc(p)}</div>`).join('');
  }
}

export function renderRight({ current, mounts }) {
  if (mounts.config) {
    const entries = Object.entries(current.config || {});
    mounts.config.innerHTML = entries.length === 0
      ? '<span class="d">No config changes</span>'
      : entries.map(([k, v]) => `<div style="font-size:6.5px"><span class="k">${esc(k)}:</span> <span class="v">${esc(formatVal(v))}</span></div>`).join('');
  }
  if (mounts.key) {
    mounts.key.innerHTML = (current.key || []).map((k) =>
      `<div style="font-size:6.5px;padding:1px 0;color:var(--ok)">✓ ${esc(k)}</div>`).join('');
  }
  if (mounts.mistakes) {
    mounts.mistakes.innerHTML = (current.mistakes || []).map((m) =>
      `<div style="font-size:6.5px;padding:1px 0;color:var(--wr)">⚠ ${esc(m)}</div>`).join('');
  }
}

function kv(k, v, tone = 'v') {
  return `<div style="font-size:6.5px"><span class="k">${esc(k)}:</span> <span class="${tone}">${esc(v)}</span></div>`;
}

function formatVal(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
