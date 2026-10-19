'use strict';

/*
 * TU SC1 Navigator - EXPERIMENTAL phone-sensor tracking
 * ------------------------------------------------------
 * This is a learning exercise, NOT an indoor GPS receiver.
 * QR sets a known START point. The phone's accelerometer produces
 * POSSIBLE steps, and device orientation estimates turning.
 * We integrate those estimates; errors accumulate with every step.
 * Changing floors is NOT detected. Do not use for safe navigation.
 *
 * Read this file alongside README_TH.txt when learning to code.
 */
(() => {
  const byId = (id) => document.getElementById(id);
  const sensorStart = byId('sensorStart');
  const sensorStop = byId('sensorStop');
  const calibrateButton = byId('calibrateHeading');
  const resetButton = byId('resetPosition');
  const manualStepButton = byId('manualStep');
  const mapDirection = byId('mapDirection');
  const pixelsStep = byId('pixelsStep');
  const pixelsValue = byId('pixelsValue');
  const sensitivity = byId('stepSensitivity');
  const sensitivityValue = byId('sensitivityValue');
  const sensorStatus = byId('sensorStatus');
  const stepCount = byId('stepCount');
  const headingReadout = byId('headingReadout');
  const positionReadout = byId('positionReadout');

  const state = {
    running: false,
    motionEvents: 0,
    orientationEvents: 0,
    zone: startEl.value,
    position: null, // [x, y] in ORIGINAL map coordinates; null means QR location
    steps: 0,
    heading: null, // phone direction in sensor coordinates, degrees
    headingOffset: null, // sensor heading -> orientation in SVG map
    accelBaseline: null,
    stepArmed: true,
    lastStepTime: -Infinity,
    lastUpdateTime: -Infinity,
    lastMode: 'qr'
  };

  function normalize(value) {
    return ((value % 360) + 360) % 360;
  }

  function message(text) {
    sensorStatus.textContent = text;
  }

  function estimatedHeading() {
    return state.heading === null || state.headingOffset === null
      ? null : normalize(state.heading + state.headingOffset);
  }

  function refreshReadings() {
    stepCount.textContent = String(state.steps);
    const heading = estimatedHeading();
    headingReadout.textContent = heading === null
      ? 'ยังไม่ตั้งทิศ / ยังไม่ได้ข้อมูลเซนเซอร์'
      : `${Math.round(heading)}° (เทียบด้านบนแผนที่)`;
    positionReadout.textContent = state.position === null
      ? 'ตำแหน่ง QR ล่าสุด'
      : `x=${Math.round(state.position[0])}, y=${Math.round(state.position[1])} · ${state.lastMode === 'manual' ? 'จำลอง' : 'จากเซนเซอร์ (ประมาณ)'}`;
  }

  function reset(zone = startEl.value) {
    if (!qrLocations[zone]) return;
    state.zone = zone;
    state.position = null;
    state.steps = 0;
    state.headingOffset = null;
    state.accelBaseline = null;
    state.stepArmed = true;
    state.lastStepTime = -Infinity;
    state.lastMode = 'qr';
    message(`รีเซ็ตเป็น ${qrLocations[zone].label} แล้ว · ต้องตั้งทิศใหม่ก่อนเดินจริง`);
    refreshReadings();
    // activateStart() will redraw immediately after calling this method.
  }

  // A deliberately simple estimate; it does NOT know walls, doors or true distance.
  function advanceOneStep(mode) {
    if (!positionActive) {
      message('โปรดเลือก Zone A หรือ B หรือสแกน QR ก่อนเริ่มเดิน');
      return false;
    }
    let heading = estimatedHeading();
    if (heading === null && mode === 'manual') {
      heading = Number(mapDirection.value);
    }
    if (heading === null) {
      message('ยังไม่มีทิศทาง: เปิดเซนเซอร์ แล้วกด “ตั้งทิศทาง” ขณะถือโทรศัพท์ให้ตรงทางเดิน');
      return false;
    }
    const initial = geometry[qrLocations[state.zone].floor][qrLocations[state.zone].node];
    const [x, y] = state.position ?? [...initial];
    const distance = Number(pixelsStep.value);
    const radians = heading * Math.PI / 180;
    // Map y grows downward; 0 degrees points towards the top of the map.
    const nextX = x + distance * Math.sin(radians);
    const nextY = y - distance * Math.cos(radians);
    // Keep the estimated dot on the image, without pretending walls constrain it.
    state.position = [
      Math.max(0, Math.min(referenceWidth, nextX)),
      Math.max(0, Math.min(referenceHeights[1], nextY))
    ];
    state.steps++;
    state.lastMode = mode;
    refreshReadings();
    draw();
    return true;
  }

  // Heading is a RELATIVE estimate: user must align it to the map.
  // On iOS, webkitCompassHeading is sometimes available; otherwise alpha
  // acts as a device heading, which may NOT be north-referenced.
  function handleOrientation(event) {
    state.orientationEvents++;
    let rawHeading = null;
    if (Number.isFinite(event.webkitCompassHeading)) {
      rawHeading = Number(event.webkitCompassHeading);
    } else if (Number.isFinite(event.alpha)) {
      rawHeading = 360 - Number(event.alpha);
    }
    if (rawHeading === null) return;
    state.heading = normalize(rawHeading);
    const now = performance.now();
    if (now - state.lastUpdateTime > 300) {
      state.lastUpdateTime = now;
      refreshReadings();
    }
  }

  // Simple peak detector; actual gait recognition requires per-phone tuning.
  // No steps are inferred from time alone. The device MUST send acceleration.
  function handleMotion(event) {
    state.motionEvents++;
    const a = event.accelerationIncludingGravity ?? event.acceleration;
    if (!a || ![a.x, a.y, a.z].every(Number.isFinite)) return;
    const magnitude = Math.hypot(a.x, a.y, a.z);
    if (state.accelBaseline === null) {
      state.accelBaseline = magnitude;
      return;
    }
    const delta = magnitude - state.accelBaseline;
    state.accelBaseline = state.accelBaseline * 0.92 + magnitude * 0.08;
    const threshold = Number(sensitivity.value);
    if (delta < threshold * 0.18) state.stepArmed = true;
    const now = performance.now();
    if (state.stepArmed && delta > threshold && now - state.lastStepTime > 380) {
      state.stepArmed = false;
      state.lastStepTime = now;
      // Count a step only when direction has been calibrated; otherwise
      // movement would misleadingly imply a known heading.
      if (advanceOneStep('sensor')) {
        message(`ตรวจพบก้าวจากเซนเซอร์ ${state.steps} ก้าว · ตำแหน่งเป็นเพียงการประมาณ อาจคลาดเคลื่อน`);
      }
    }
  }

  async function startSensors() {
    if (state.running) return;
    if (!window.isSecureContext) {
      message('ต้องเปิดเว็บผ่าน HTTPS หรือ localhost เพื่อใช้เซนเซอร์โทรศัพท์ (file:// ไม่รองรับอย่างเชื่อถือได้)');
      return;
    }
    if (!('DeviceMotionEvent' in window) || !('DeviceOrientationEvent' in window)) {
      message('เบราว์เซอร์นี้ไม่รองรับ Motion/Orientation API ครบทั้งสองอย่าง ลอง Safari บน iPhone หรือ Chrome บน Android รุ่นที่รองรับ');
      return;
    }
    sensorStart.disabled = true;
    message('กำลังขออนุญาตเข้าถึงเซนเซอร์…');
    try {
      // On iOS both permission requests must be initiated by this actual click.
      // Start both promises before awaiting either one.
      const motionPromise = typeof DeviceMotionEvent.requestPermission === 'function'
        ? DeviceMotionEvent.requestPermission() : Promise.resolve('granted');
      const orientationPromise = typeof DeviceOrientationEvent.requestPermission === 'function'
        ? DeviceOrientationEvent.requestPermission() : Promise.resolve('granted');
      const [motionPermission, orientationPermission] = await Promise.all([
        motionPromise, orientationPromise
      ]);
      if (motionPermission !== 'granted' || orientationPermission !== 'granted') {
        message('โทรศัพท์ไม่ได้อนุญาตเซนเซอร์ครบทั้งสองชนิด โปรดตรวจการตั้งค่าเบราว์เซอร์');
        sensorStart.disabled = false;
        return;
      }
      state.motionEvents = 0;
      state.orientationEvents = 0;
      state.accelBaseline = null;
      state.stepArmed = true;
      window.addEventListener('devicemotion', handleMotion);
      window.addEventListener('deviceorientation', handleOrientation);
      state.running = true;
      sensorStop.disabled = false;
      message('กำลังอ่านเซนเซอร์: ถือโทรศัพท์ให้แบน หันหัวเครื่องไปข้างหน้า แล้วกดตั้งทิศทางก่อนเดิน');
      window.setTimeout(() => {
        if (!state.running) return;
        if (state.motionEvents === 0 || state.orientationEvents === 0) {
          message('เปิดสิทธิ์แล้ว แต่ยังไม่ได้รับข้อมูลเซนเซอร์ครบ ลองตรวจสิทธิ์/HTTPS/เบราว์เซอร์ หรือใช้ปุ่มจำลองก้าว');
        }
      }, 4500);
    } catch (error) {
      message(`เปิดเซนเซอร์ไม่สำเร็จ: ${error?.message || String(error)}`);
      sensorStart.disabled = false;
    }
  }

  function stopSensors() {
    window.removeEventListener('devicemotion', handleMotion);
    window.removeEventListener('deviceorientation', handleOrientation);
    state.running = false;
    sensorStart.disabled = false;
    sensorStop.disabled = true;
    message('หยุดอ่านเซนเซอร์แล้ว จุดสีน้ำเงินค้างที่ตำแหน่งประมาณล่าสุด');
  }

  function calibrate() {
    if (!positionActive) {
      message('ต้องสแกน QR หรือกดเลือก Zone A / B ก่อนตั้งทิศทาง');
      return;
    }
    if (!state.running || state.heading === null || state.orientationEvents === 0) {
      message('ยังไม่ได้รับค่าทิศจากเซนเซอร์ กรุณาเปิดเซนเซอร์บนโทรศัพท์ก่อน');
      return;
    }
    const mapHeading = Number(mapDirection.value);
    state.headingOffset = normalize(mapHeading - state.heading);
    message(`ตั้งทิศแล้ว: ด้านบนของโทรศัพท์ขณะนี้ตรงกับทิศ ${mapHeading}° บนแผนที่ · ลองเดินตรงไม่กี่ก้าว`);
    refreshReadings();
  }

  // Small public interface used by the existing script.js.
  window.SC1PDR = {
    getPosition: () => state.position ? [...state.position] : null,
    reset
  };

  sensorStart.addEventListener('click', startSensors);
  sensorStop.addEventListener('click', stopSensors);
  calibrateButton.addEventListener('click', calibrate);
  resetButton.addEventListener('click', () => {
    activateStart(startEl.value, 'manual');
    draw();
  });
  manualStepButton.addEventListener('click', () => {
    if (!positionActive) {
      activateStart(startEl.value, 'manual');
    }
    if (advanceOneStep('manual')) {
      message('เพิ่มก้าวจำลอง 1 ก้าว (ไม่ใช่ผลอ่านจากเซนเซอร์)');
    }
  });
  pixelsStep.addEventListener('input', () => {
    pixelsValue.textContent = `${pixelsStep.value} หน่วย/ก้าว (ต้องปรับเทียบ)`;
  });
  sensitivity.addEventListener('input', () => {
    sensitivityValue.textContent = `${sensitivity.value} (เพิ่มหากนับก้าวเกิน)`;
  });
  window.addEventListener('pagehide', stopSensors);

  // A QR query string has already initialized the QR start in script.js.
  reset(startEl.value);
  refreshReadings();
  draw();
})();
