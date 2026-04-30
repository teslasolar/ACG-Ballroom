// Tiny render loop. Each tick: controls.update(), renderer.animate(t),
// then renderer.render(scene, camera). If a CSS3D pass is supplied we
// render it on top so live iframe walls show through. onHud fires every
// 10 frames so we don't thrash the DOM.

export function startLoop({
  controls, ballroomRenderer, threeRenderer,
  scene, camera, onHud,
  cssRenderer = null, cssScene = null,
}) {
  let lastT = 0, frame = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = (now - lastT) / 1000; lastT = now; frame++;
    const t = now / 1000;
    controls.update();
    ballroomRenderer.animate(t);
    threeRenderer.render(scene, camera);
    if (cssRenderer && cssScene) cssRenderer.render(cssScene, camera);
    if (onHud && frame % 10 === 0) onHud({ t, dt, frame });
  }
  requestAnimationFrame(tick);
}
