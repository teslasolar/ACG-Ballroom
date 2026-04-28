// Recursively load all UDT templates from src/design/udts/ and instances
// from src/design/instances/ (or any caller-supplied dir). Zero deps.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
export const UDT_DIR = path.join(root, 'src/design/udts');
export const INSTANCE_DIR = path.join(root, 'src/design/instances');

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.isFile() && ent.name.endsWith('.json')) yield p;
  }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (err) { throw new Error(`bad json: ${p}: ${err.message}`); }
}

export function loadTemplates(dir = UDT_DIR) {
  const map = new Map();
  for (const file of walk(dir)) {
    const j = readJson(file);
    if (!j.udt) throw new Error(`${file}: missing 'udt' field`);
    if (map.has(j.udt)) throw new Error(`${file}: duplicate udt name ${j.udt}`);
    j._file = path.relative(root, file);
    map.set(j.udt, j);
  }
  return map;
}

export function loadInstances(dir = INSTANCE_DIR) {
  const list = [];
  for (const file of walk(dir)) {
    const j = readJson(file);
    const rel = path.relative(root, file);
    const items = Array.isArray(j) ? j : [j];
    items.forEach((item, i) => {
      if (!item || !item.udt) throw new Error(`${file}[${i}]: missing 'udt' field`);
      item._file = items.length > 1 ? `${rel}[${i}]` : rel;
      list.push(item);
    });
  }
  return list;
}

// Resolve the full member set by walking the extends chain.
export function resolvedMembers(udtName, templates) {
  const chain = [];
  let cur = udtName;
  const seen = new Set();
  while (cur) {
    if (seen.has(cur)) throw new Error(`circular extends at ${cur}`);
    seen.add(cur);
    const t = templates.get(cur);
    if (!t) throw new Error(`unknown udt: ${cur}`);
    chain.unshift(t);
    cur = t.extends || null;
  }
  const merged = {};
  for (const t of chain) Object.assign(merged, t.members || {});
  return { members: merged, chain };
}
