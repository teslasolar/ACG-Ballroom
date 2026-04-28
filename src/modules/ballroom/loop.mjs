// Tiny render loop. Each tick: controls.update(), renderer.animate(t),
// then renderer.render(scene, camera). onFrame is called every 10 frames
// for HUD updates so we don't thrash the DOM.

export function startLoop({ controls, ballroomRenderer, threeRenderer, scene, camera, onHud }) {
  let lastT = 0, frame = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = (now - lastT) / 1000; lastT = now; frame++;
    const t = now / 1000;
    controls.update();
    ballroomRenderer.animate(t);
    threeRenderer.render(scene, camera);
    if (onHud && frame % 10 === 0) onHud({ t, dt, frame });
  }
  requestAnimationFrame(tick);
}
