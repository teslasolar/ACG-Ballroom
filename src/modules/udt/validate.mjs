// Validate templates and instances against the typespec grammar.
//
// Grammar (matches src/design/udts/_meta.json#typespec_grammar):
//   scalar:   str | int | float | bool | emoji | md | code | color
//   optional: <T>?
//   array:    <T>[]
//   enum:     enum:A|B|C
//   map:      kv<K,V>
//   ref:      ref<UdtName>
//   nested:   udt:UdtName
//   typespec  (any of the above, anywhere typespec is allowed)
//
// Returns { ok, errors, counts }.

const SCALAR = new Set(['str', 'int', 'float', 'bool', 'emoji', 'md', 'code', 'color', 'any', 'typespec']);

function parseSpec(spec) {
  let s = String(spec).trim();
  let optional = false;
  if (s.endsWith('?')) { optional = true; s = s.slice(0, -1); }
  let array = false;
  if (s.endsWith('[]')) { array = true; s = s.slice(0, -2); }
  if (s.startsWith('enum:')) return { kind: 'enum', values: s.slice(5).split('|'), array, optional };
  if (s.startsWith('kv<') && s.endsWith('>'))   return { kind: 'kv',     inner: s.slice(3, -1), array, optional };
  if (s.startsWith('ref<') && s.endsWith('>'))  return { kind: 'ref',    target: s.slice(4, -1), array, optional };
  if (s.startsWith('udt:'))                     return { kind: 'nested', target: s.slice(4),    array, optional };
  if (SCALAR.has(s))                            return { kind: 'scalar', name: s, array, optional };
  return { kind: 'unknown', raw: s, array, optional };
}

function checkScalar(name, v) {
  if (name === 'str' || name === 'md' || name === 'code' || name === 'emoji' || name === 'color') return typeof v === 'string';
  if (name === 'int') return Number.isInteger(v);
  if (name === 'float') return typeof v === 'number' && Number.isFinite(v);
  if (name === 'bool') return typeof v === 'boolean';
  if (name === 'any' || name === 'typespec') return true;
  return false;
}

function validateValue(spec, value, ctx, errors, templates, idIndex) {
  const s = parseSpec(spec);
  if (value === undefined || value === null) {
    if (s.optional) return;
    errors.push(`${ctx}: required, got ${value}`);
    return;
  }
  const items = s.array ? (Array.isArray(value) ? value : [errors.push(`${ctx}: expected array`)]) : [value];
  if (s.array && !Array.isArray(value)) return;
  items.forEach((v, i) => {
    const c = s.array ? `${ctx}[${i}]` : ctx;
    if (s.kind === 'scalar') { if (!checkScalar(s.name, v)) errors.push(`${c}: expected ${s.name}, got ${typeof v}`); }
    else if (s.kind === 'enum') { if (!s.values.includes(v)) errors.push(`${c}: '${v}' not in enum [${s.values.join('|')}]`); }
    else if (s.kind === 'kv') { if (!v || typeof v !== 'object' || Array.isArray(v)) errors.push(`${c}: expected object`); }
    else if (s.kind === 'ref') {
      if (typeof v !== 'string') { errors.push(`${c}: ref must be string id`); return; }
      if (idIndex && !idIndex.has(v)) errors.push(`${c}: ref '${v}' (${s.target}) not found`);
    }
    else if (s.kind === 'nested') {
      if (!v || typeof v !== 'object') { errors.push(`${c}: nested udt must be object`); return; }
      if (v.udt && v.udt !== s.target) {
        // allow descendants of s.target
        let cur = v.udt, ok = false;
        while (cur) { if (cur === s.target) { ok = true; break; } cur = templates.get(cur)?.extends || null; }
        if (!ok) errors.push(`${c}: nested udt '${v.udt}' not assignable to ${s.target}`);
      }
      validateInstance(v, c, errors, templates, idIndex, s.target);
    }
    else errors.push(`${c}: unknown typespec '${spec}'`);
  });
}

function validateInstance(inst, ctx, errors, templates, idIndex, fallbackUdt = null) {
  const udtName = inst.udt || fallbackUdt;
  if (!udtName) { errors.push(`${ctx}: instance missing 'udt' field`); return; }
  const t = templates.get(udtName);
  if (!t) { errors.push(`${ctx}: unknown udt '${udtName}'`); return; }
  let merged;
  try { merged = resolvedMembers(udtName, templates).members; }
  catch (err) { errors.push(`${ctx}: ${err.message}`); return; }
  for (const [k, spec] of Object.entries(merged)) {
    validateValue(spec, inst[k], `${ctx}.${k}`, errors, templates, idIndex);
  }
}

export function resolvedMembers(udtName, templates) {
  const chain = [];
  let cur = udtName, seen = new Set();
  while (cur) {
    if (seen.has(cur)) throw new Error(`circular extends at ${cur}`);
    seen.add(cur);
    const t = templates.get(cur);
    if (!t) throw new Error(`unknown udt '${cur}'`);
    chain.unshift(t);
    cur = t.extends || null;
  }
  const members = {};
  for (const t of chain) Object.assign(members, t.members || {});
  return { members, chain };
}

export function validate(templates, instances) {
  const errors = [];
  const idIndex = new Map();
  for (const inst of instances) if (inst.id) idIndex.set(inst.id, inst);

  // Templates validate themselves (every member spec must parse cleanly)
  for (const t of templates.values()) {
    if (t.kind === 'meta') continue;
    if (!t.kind) errors.push(`${t._file}: missing 'kind'`);
    if (t.extends && !templates.has(t.extends)) errors.push(`${t._file}: extends unknown udt '${t.extends}'`);
    for (const [k, spec] of Object.entries(t.members || {})) {
      const s = parseSpec(spec);
      if (s.kind === 'unknown') errors.push(`${t._file}: member ${k} has unknown typespec '${spec}'`);
      if (s.kind === 'ref' && !templates.has(s.target)) errors.push(`${t._file}: member ${k} refs unknown udt '${s.target}'`);
      if (s.kind === 'nested' && !templates.has(s.target)) errors.push(`${t._file}: member ${k} nests unknown udt '${s.target}'`);
    }
  }

  // Instances validate against their template
  for (const inst of instances) {
    validateInstance(inst, inst._file || inst.id || '<inst>', errors, templates, idIndex);
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: { templates: templates.size, instances: instances.length, errors: errors.length },
  };
}
