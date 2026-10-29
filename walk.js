'use strict';
(() => {
  const walk = document.getElementById('walkToggle');
  const wake = document.getElementById('wakeToggle');
  const status = document.getElementById('wakeStatus');
  const notice = document.getElementById('walkNotice');
  let walking = false;
  let requested = false;
  let lock = null;
  let pending = false;

  async function release() {
    const previous = lock;
    lock = null;
    if (previous) { try { await previous.release(); } catch {} }
  }

  async function acquire() {
    if (!requested || pending || lock || document.visibilityState !== 'visible') return;
    if (!window.isSecureContext || !navigator.wakeLock) {
      requested = false;
      wake.setAttribute('aria-pressed', 'false');
      status.textContent = 'เปิดจอค้างไม่ได้: ต้องใช้ HTTPS และเบราว์เซอร์ที่รองรับ';
      return;
    }
    pending = true;
    try {
      const obtained = await navigator.wakeLock.request('screen');
      if (!requested || document.visibilityState !== 'visible') {
        await obtained.release();
        return;
      }
      lock = obtained;
      status.textContent = 'เปิดจอค้างแล้ว · ใช้ได้ขณะหน้าเว็บนี้แสดงอยู่';
      obtained.addEventListener('release', () => {
        if (lock !== obtained) return;
        lock = null;
        status.textContent = 'ระบบปล่อยการเปิดจอค้างแล้ว · กดปิดแล้วเปิดอีกครั้งเพื่อลองใหม่';
      });
    } catch {
      status.textContent = 'ระบบไม่อนุญาตให้เปิดจอค้าง · ตรวจโหมดประหยัดแบตเตอรี่ แล้วลองใหม่';
    } finally { pending = false; }
  }

  wake.addEventListener('click', async () => {
    requested = !requested;
    wake.setAttribute('aria-pressed', String(requested));
    wake.textContent = requested ? 'ปิดจอค้าง' : 'เปิดจอค้าง';
    if (requested) await acquire();
    else { await release(); status.textContent = 'ปิดการเปิดจอค้างแล้ว'; }
    if (!requested) wake.textContent = 'เปิดจอค้าง';
  });

  walk.addEventListener('click', async () => {
    walking = !walking;
    document.body.classList.toggle('walking', walking);
    walk.setAttribute('aria-pressed', String(walking));
    walk.textContent = walking ? 'ออกจากโหมดเดิน' : 'เปิดโหมดเดิน';
    if (walking) {
      document.querySelector('.mapPanel').scrollIntoView({ block: 'start' });
      document.querySelector('.sensorPanel').open = true;
    } else {
      requested = false;
      wake.setAttribute('aria-pressed', 'false');
      wake.textContent = 'เปิดจอค้าง';
      await release();
      status.textContent = 'ปิดการเปิดจอค้างแล้ว';
    }
  });

  function pause() {
    window.SC1PDR?.pause();
    if (walking) {
      notice.hidden = false;
      notice.textContent = 'พักการติดตามแล้ว ตำแหน่งบนแผนที่เป็นตำแหน่งก่อนพัก หากยังอยู่ที่เดิม ให้เปิดเซนเซอร์และตั้งทิศใหม่ หากเดินต่อระหว่างพัก ตำแหน่งจะไม่ตรง — เริ่มใหม่เมื่อกลับไปถึงจุด QR เดิม';
    }
    void release();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pause();
    else void acquire();
  });
  window.addEventListener('pagehide', pause);
})();
