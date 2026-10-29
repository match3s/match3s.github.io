'use strict';
(() => {
  const key = 'sc1-navigation-v1';
  const dialog = document.getElementById('resumeDialog');
  const saveStatus = document.getElementById('saveStatus');
  let pending = false;
  let saved = null;
  function storageError() {
    saveStatus.hidden = false;
    saveStatus.textContent = 'เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูล ตำแหน่งอาจหายเมื่อรีโหลด';
  }
  function valid(s) {
    return s && s.version === 1 && Object.hasOwn(qrLocations, s.zone)
      && Number.isFinite(s.time) && s.time <= Date.now() + 60000
      && Number.isInteger(s.steps) && s.steps >= 0
      && ['qr', 'manual', 'sensor'].includes(s.mode)
      && (s.room === '' || rooms.has(s.room))
      && (s.position === null || (Array.isArray(s.position) && s.position.length === 2
        && s.position.every(Number.isFinite) && s.position[0] >= 0
        && s.position[0] <= referenceWidth && s.position[1] >= 0
        && s.position[1] <= referenceHeights[1]));
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { saved = JSON.parse(raw); } catch { saved = null; }
      if (!valid(saved)) { saved = null; localStorage.removeItem(key); }
    }
  } catch { storageError(); }

  function save() {
    if (pending || !positionActive) return;
    const room = roomEl.value.toUpperCase().trim();
    const snapshot = { ...window.SC1PDR.snapshot(), version: 1,
      room: rooms.has(room) ? room : '', time: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(snapshot)); }
    catch { storageError(); }
  }
  window.SC1Session = { save };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);

  // A different QR or explicit destination starts a fresh journey.
  const query = new URLSearchParams(location.search);
  const differentStart = Object.hasOwn(qrLocations, query.get('start')) && query.get('start') !== saved?.zone;
  const differentRoom = query.has('room') && query.get('room').toUpperCase().trim() !== saved?.room;
  if (saved && !differentStart && !differentRoom) {
    pending = true;
    // Never present the saved point as current until confirmed.
    positionActive = false;
    draw();
    document.getElementById('resumeDescription').textContent =
      `${saved.room ? 'ปลายทาง ' + saved.room : 'ยังไม่ได้เลือกห้อง'} · ชั้น 1 · ${saved.steps} ก้าว${saved.mode === 'manual' ? ' (จำลอง)' : ''} · บันทึก ${new Date(saved.time).toLocaleString('th-TH')}`;
    dialog.showModal();
  } else save();

  function dismiss() {
    pending = false;
    dialog.close();
  }
  document.getElementById('resumeYes').addEventListener('click', () => {
    if (!saved) return;
    startEl.value = saved.zone;
    roomEl.value = saved.room;
    positionActive = true;
    positionSource = 'manual';
    window.SC1PDR.restore(saved);
    if (saved.room) calculate();
    else showFloor(1);
    document.querySelector('.sensorPanel').open = true;
    dismiss(); save();
  });
  function startFresh() {
    try { localStorage.removeItem(key); } catch { storageError(); }
    window.SC1PDR.pause();
    window.SC1PDR.reset(startEl.value);
    positionActive = false;
    lastRoute = null;
    roomEl.value = '';
    stepsEl.replaceChildren();
    dismiss(); draw();
    statusEl.textContent = 'เริ่มใหม่: เลือกจุดเริ่มต้นเมื่อคุณอยู่ที่ Zone A หรือ B จริง';
  }
  document.getElementById('resumeNo').addEventListener('click', startFresh);
  dialog.addEventListener('cancel', event => { event.preventDefault(); startFresh(); });
})();
