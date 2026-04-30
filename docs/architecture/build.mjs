// build.mjs — render every diagrams/*.mmd → svg/<name>.svg
//
// Usage:
//   node docs/architecture/build.mjs
//
// Requires `npx -y @mermaid-js/mermaid-cli` to be reachable. No local install
// needed — npx will download it the first time. Outputs are static SVGs that
// can be embedded by docs/architecture/index.html.

import { readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, extname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const HERE       = dirname(fileURLToPath(import.meta.url));
const SRC_DIR    = join(HERE, 'diagrams');
const OUT_DIR    = join(HERE, 'svg');
const CONFIG     = join(HERE, 'mermaid.config.json');
const BG         = 'transparent';

// On Windows the npx executable is `npx.cmd`; spawn() needs the right name.
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    p.on('error', rej);
    p.on('exit', (code) => code === 0 ? res() : rej(new Error(`${cmd} exit ${code}`)));
  });
}

async function ensureDir(d) { await mkdir(d, { recursive: true }); }

async function isStale(src, dst) {
  try {
    const [a, b] = await Promise.all([stat(src), stat(dst)]);
    return a.mtimeMs > b.mtimeMs;
  } catch { return true; }
}

async function build() {
  await ensureDir(OUT_DIR);
  const entries = (await readdir(SRC_DIR)).filter((f) => extname(f) === '.mmd').sort();
  if (!entries.length) { console.log('[build] no .mmd files'); return; }

  console.log(`[build] ${entries.length} diagrams → ${OUT_DIR}`);
  for (const file of entries) {
    const src = join(SRC_DIR, file);
    const out = join(OUT_DIR, basename(file, '.mmd') + '.svg');
    if (!await isStale(src, out)) {
      console.log(`  · ${file}  (up to date)`);
      continue;
    }
    console.log(`  → ${file}`);
    await run(NPX, [
      '-y', '@mermaid-js/mermaid-cli',
      '-i', src,
      '-o', out,
      '-b', BG,
      '-c', CONFIG,
      '-t', 'dark',
    ]);
  }
  console.log('[build] done.');
}

build().catch((err) => { console.error(err); process.exit(1); });
