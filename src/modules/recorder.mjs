// Display-capture recorder. Shared by ballroom + tutorial. attach() returns
// { toggle, isRecording }. Caller wires a button's onclick to toggle().
//
// Browser support: Chrome/Edge for full mp4; Firefox falls back to webm.
// User has to grant the screen-capture prompt — that's a native dialog,
// not anything we can paper over.

export function attach({ button, basename = 'capture' } = {}) {
  let rec = null;
  let chunks = [];
  const onStop = [];

  async function start() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser', frameRate: 30 },
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      systemAudio: 'include',
    });
    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,opus')
      ? 'video/mp4;codecs=avc1,opus'
      : 'video/webm';

    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
    chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${basename}${mime.includes('mp4') ? '.mp4' : '.webm'}`;
      a.click();
      if (button) {
        button.textContent = '● REC';
        button.classList.remove('on');
      }
      onStop.forEach((fn) => { try { fn(); } catch (_) {} });
    };
    stream.getVideoTracks()[0].onended = () => {
      if (rec && rec.state === 'recording') rec.stop();
    };
    rec.start(1000);
    if (button) {
      button.textContent = '■ STOP';
      button.classList.add('on');
    }
  }

  async function toggle() {
    if (!rec || rec.state !== 'recording') {
      try { await start(); } catch (_) { /* user cancelled prompt */ }
    } else {
      rec.stop();
    }
  }

  function isRecording() { return !!rec && rec.state === 'recording'; }

  if (button) button.onclick = toggle;

  return { toggle, isRecording, onStop: (fn) => onStop.push(fn) };
}
