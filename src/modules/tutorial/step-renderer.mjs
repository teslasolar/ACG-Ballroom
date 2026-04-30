// Render one TutorialStep instance into a stage container as a .scene block.
// CSS classes match the original ignition tutorial layout (.scene, .cb, .tip,
// .warn). One DOM element per step; flipping active = visible.

const sceneById = new Map();
let activeId = null;

export function buildAllScenes({ steps, container }) {
  // Clear existing
  for (const el of container.querySelectorAll('.scene')) el.remove();
  sceneById.clear();
  for (const step of steps) {
    const el = document.createElement('div');
    el.className = 'scene';
    el.id = `sc${step.index}`;
    el.innerHTML = renderStep(step);
    container.appendChild(el);
    sceneById.set(step.id, el);
  }
}

export function showStep(step) {
  for (const el of sceneById.values()) el.classList.remove('active');
  const el = sceneById.get(step.id);
  if (el) el.classList.add('active');
  activeId = step.id;
}

export function activeStepId() { return activeId; }

function renderStep(s) {
  const phase = `<h2 style="color:var(--ign)">${esc(s.phase)} · Step ${s.index + 1}/24</h2>`;
  const head = `<h1>${esc(s.ico || '')} ${esc(s.h1 || '')}</h1><h2>${esc(s.h2 || '')}</h2>`;
  const body = s.body ? `<p>${esc(s.body)}</p>` : '';
  const code = s.code
    ? `<div class="cb"><pre style="margin:0;white-space:pre-wrap;color:var(--ok);font-size:inherit">${esc(s.code)}</pre></div>`
    : '';
  const key = (s.key && s.key.length > 0)
    ? `<div class="tip"><strong>Key:</strong> ${esc(s.key[0])}</div>`
    : '';
  const warn = (s.mistakes && s.mistakes.length > 0)
    ? `<div class="warn"><strong>⚠️ Mistake:</strong> ${esc(s.mistakes[0])}</div>`
    : '';
  return phase + head + body + code + key + warn;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
