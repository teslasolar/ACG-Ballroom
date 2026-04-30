// Ignition tutorial bootstrap.
//
//   1. Load themes (lights on/off) and the 24 TutorialStep instances.
//   2. Build the step DOM (one .scene per step) inside the stage.
//   3. Wire nav (prev / next / auto / keyboard / progress click), audio
//      sync (drag-drop or file pick), and the recorder button.
//   4. Re-paint the sidebars whenever the active step changes.

import * as theme from '../modules/theme.mjs';
import { attach as attachRecorder } from '../modules/recorder.mjs';
import { buildAllScenes, showStep } from '../modules/tutorial/step-renderer.mjs';
import { renderLeft, renderRight } from '../modules/tutorial/sidebar-renderer.mjs';
import { makeNav } from '../modules/tutorial/nav.mjs';
import { attach as attachAudio } from '../modules/tutorial/audio-sync.mjs';

const STEP_FILES = [
  '00-welcome', '01-download', '02-run-installer', '03-first-launch',
  '04-eula', '05-create-admin', '06-gateway-home', '07-modules',
  '08-database', '09-tag-historian', '10-opc-connection', '11-browse-opc',
  '12-tag-provider', '13-create-folder', '14-create-udt', '15-opc-tag',
  '16-expression-tag', '17-install-designer', '18-create-project',
  '19-tag-browser', '20-first-view', '21-tag-bindings', '22-script-console',
  '23-launch',
];

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`fetch ${url} failed: ${r.status}`);
  return r.json();
}

async function main() {
  await theme.loadBundleFromUrl('../src/design/instances/themes/dark.json');
  await theme.loadBundleFromUrl('../src/design/instances/themes/light.json');
  theme.restoreOrApply('theme.dark');

  const themeBtn = document.getElementById('themeBt');
  if (themeBtn) {
    themeBtn.onclick = () => theme.toggle();
    const reflect = (b) => { themeBtn.title = b.scheme === 'light' ? 'Lights off' : 'Lights on'; };
    reflect(theme.activeBundle());
    theme.onChange(reflect);
  }

  const steps = await Promise.all(STEP_FILES.map((slug) =>
    fetchJson(`../src/design/instances/tutorial/${slug}.json`)));
  // Defensive sort: rendering relies on steps[i].index === i
  steps.sort((a, b) => a.index - b.index);

  const stage = document.getElementById('stage');
  buildAllScenes({ steps, container: stage });

  const mountsLeft = {
    tree: document.getElementById('stepTree'),
    udt: document.getElementById('stepUDT'),
    prereqs: document.getElementById('prereqs'),
  };
  const mountsRight = {
    config: document.getElementById('config'),
    key: document.getElementById('keyInfo'),
    mistakes: document.getElementById('mistakes'),
  };

  const nav = makeNav({
    steps,
    els: {
      phase: document.getElementById('phase'),
      stepCt: document.getElementById('stepCt'),
      tmr: document.getElementById('tmr'),
      progF: document.getElementById('progF'),
      prog: document.getElementById('prog'),
      drop: document.getElementById('drop'),
      prevBtn: document.getElementById('prevBt'),
      nextBtn: document.getElementById('nextBt'),
      autoBtn: document.getElementById('autoBt'),
    },
    onChange(step, i) {
      showStep(step);
      renderLeft({ steps, current: step, mounts: mountsLeft, onJump: nav.goTo });
      renderRight({ current: step, mounts: mountsRight });
    },
  });

  attachRecorder({ button: document.getElementById('rB'), basename: 'Ignition_Tutorial' });

  attachAudio({
    audioEl: document.getElementById('audio'),
    fileInput: document.getElementById('fileIn'),
    dropZone: document.getElementById('drop'),
    totalSteps: steps.length,
    onTick: (i) => { if (i !== nav.currentIndex()) nav.goTo(i); },
  });

  nav.goTo(0);
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#ff4466;padding:24px;font:12px monospace">${err.stack || err.message}</pre>`;
});
