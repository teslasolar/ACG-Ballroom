// Theme module: load ThemeBundles, apply tokens to :root as CSS vars,
// persist choice in localStorage, expose a toggle. Framework-free.

const STORAGE_KEY = 'acg.theme';
const bundles = new Map();
const subscribers = new Set();
let active = null;

export function registerBundle(bundle) {
  if (!bundle || bundle.udt !== 'ThemeBundle') throw new Error('not a ThemeBundle');
  bundles.set(bundle.id, bundle);
}

export async function loadBundleFromUrl(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`theme fetch failed: ${url}`);
  const j = await r.json();
  registerBundle(j);
  return j;
}

export function applyBundle(idOrBundle) {
  const b = typeof idOrBundle === 'string' ? bundles.get(idOrBundle) : idOrBundle;
  if (!b) throw new Error(`unknown theme bundle: ${idOrBundle}`);
  const root = document.documentElement;
  for (const t of b.tokens) root.style.setProperty(t.varName, t.value);
  root.dataset.theme = b.scheme;
  active = b.id;
  try { localStorage.setItem(STORAGE_KEY, b.id); } catch (_) {}
  for (const fn of subscribers) {
    try { fn(b); } catch (err) { console.error('theme subscriber threw:', err); }
  }
  return b;
}

export function toggle() {
  if (!active) return;
  const ids = [...bundles.keys()];
  if (ids.length < 2) return;
  const i = ids.indexOf(active);
  const next = ids[(i + 1) % ids.length];
  applyBundle(next);
  return next;
}

export function activeId() { return active; }
export function activeBundle() { return active ? bundles.get(active) : null; }

export function onChange(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function tokenValue(bundle, varName) {
  const t = bundle && bundle.tokens && bundle.tokens.find((x) => x.varName === varName);
  return t ? t.value : null;
}

export function restoreOrApply(defaultId) {
  let id = null;
  try { id = localStorage.getItem(STORAGE_KEY); } catch (_) {}
  if (id && bundles.has(id)) return applyBundle(id);
  return applyBundle(defaultId);
}
