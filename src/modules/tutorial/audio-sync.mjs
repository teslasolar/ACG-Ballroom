// Audio scrubbing: drop or pick an audio file, the tutorial auto-advances by
// audio.currentTime / audio.duration → step index.

export function attach({ audioEl, fileInput, dropZone, totalSteps, onTick }) {
  let loaded = false;

  function load(file) {
    if (!file || !file.type.startsWith('audio')) return;
    audioEl.src = URL.createObjectURL(file);
    audioEl.load();
    audioEl.oncanplay = () => { loaded = true; if (dropZone) dropZone.classList.add('hidden'); };
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => load(fileInput.files[0]));
  }
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput && fileInput.click());
  }
  document.addEventListener('dragover', (e) => { e.preventDefault(); dropZone && dropZone.classList.add('over'); });
  document.addEventListener('dragleave', () => dropZone && dropZone.classList.remove('over'));
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone && dropZone.classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files[0]) load(e.dataTransfer.files[0]);
  });

  function tick() {
    requestAnimationFrame(tick);
    if (!loaded || audioEl.paused) return;
    const dur = isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.duration : 300;
    const idx = Math.min(Math.floor((audioEl.currentTime / dur) * totalSteps), totalSteps - 1);
    onTick(idx);
  }
  requestAnimationFrame(tick);

  return {
    isLoaded: () => loaded,
    play: () => audioEl.play(),
    pause: () => audioEl.pause(),
  };
}
