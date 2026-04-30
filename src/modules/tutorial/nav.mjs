// Tutorial nav: prev/next/auto + keyboard + click-to-seek progress bar.
//
// Pure state holder + DOM wiring. Calls onChange(step, index) whenever the
// active step shifts so the renderers can re-paint.

const AUTO_INTERVAL_MS = 8000;

export function makeNav({ steps, els, onChange }) {
  const total = steps.length;
  let i = -1;
  let autoTimer = null;

  function goTo(next) {
    if (next < 0 || next >= total) return;
    if (next === i) return;
    i = next;
    if (els.phase) els.phase.textContent = `${steps[i].phase} · ${steps[i].title}`;
    if (els.stepCt) els.stepCt.textContent = `${i + 1}/${total}`;
    if (els.tmr) els.tmr.textContent = `${i + 1}/${total}`;
    if (els.progF) els.progF.style.width = `${((i + 1) / total) * 100}%`;
    if (els.drop) els.drop.classList.add('hidden');
    onChange && onChange(steps[i], i);
  }

  const next = () => goTo(Math.min(i + 1, total - 1));
  const prev = () => goTo(Math.max(i - 1, 0));

  function toggleAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      if (els.autoBtn) {
        els.autoBtn.textContent = '▶ AUTO';
        els.autoBtn.classList.remove('on');
      }
      return;
    }
    if (i < 0) goTo(0);
    autoTimer = setInterval(() => {
      if (i >= total - 1) { toggleAuto(); return; }
      next();
    }, AUTO_INTERVAL_MS);
    if (els.autoBtn) {
      els.autoBtn.textContent = '⏸ STOP';
      els.autoBtn.classList.add('on');
    }
  }

  if (els.prevBtn) els.prevBtn.onclick = prev;
  if (els.nextBtn) els.nextBtn.onclick = next;
  if (els.autoBtn) els.autoBtn.onclick = toggleAuto;
  if (els.prog) els.prog.onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    goTo(Math.floor(((e.clientX - r.left) / r.width) * total));
  };

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === ' ') { e.preventDefault(); toggleAuto(); }
  });

  return { goTo, next, prev, toggleAuto, currentIndex: () => i };
}
