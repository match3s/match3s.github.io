'use strict';

// ===============================================================
// TU SC1 Navigator | QR blue-dot learning prototype
//
// IMPORTANT: All corridor / door / stair positions below are only
// estimates inherited from the first prototype. NOT field verified.
// A QR identifies a fixed place where the code is physically mounted;
// it does not track movement after the scan.
// ===============================================================

// (1) Original coordinate system of the supplied four floor images.
const referenceWidth = 1284;
const referenceHeights = { 1: 1134, 2: 1124, 3: 1139, 4: 1070 };

// (2) Graph nodes. We keep the original coordinate system for learning.
//     renderPoint() below scales points to each image's actual dimensions.
const geometry = {
  1: {
    a: [645, 568], left: [380, 488], right: [908, 492],
    bl: [472, 292], bm: [643, 225], br: [822, 292],
    bLeft1: [550, 242], bRight1: [735, 242],
    b: [645, 132], la: [282, 487], ra: [1000, 488],
    front: [645, 675], bottomL: [498, 665], bottomR: [789, 664]
  },
  2: {
    a: [645, 630], left: [365, 554], right: [935, 556],
    bl: [423, 363], bm: [645, 291], br: [866, 362],
    b: [645, 230], la: [205, 553], ra: [1090, 558],
    front: [645, 734], bottomL: [496, 718], bottomR: [806, 718]
  },
  3: {
    a: [645, 653], left: [345, 599], right: [951, 604],
    bl: [425, 393], bm: [645, 284], br: [866, 394],
    b: [645, 234], la: [195, 597], ra: [1088, 599],
    front: [645, 752], bottomL: [494, 738], bottomR: [798, 737]
  },
  4: {
    a: [645, 685], left: [350, 637], right: [943, 637],
    bl: [425, 425], bm: [645, 333], br: [866, 425],
    b: [645, 284], la: [192, 635], ra: [1100, 632],
    front: [645, 736], bottomL: [460, 689], bottomR: [820, 690]
  }
};

// (3) Each floor has its OWN walking connections.
const baseLinks = [
  ['front', 'a'], ['a', 'left'], ['a', 'right'],
  ['left', 'la'], ['right', 'ra'],
  ['a', 'bottomL'], ['a', 'bottomR'],
  ['left', 'bl'], ['right', 'br'],
  ['bl', 'bm'], ['bm', 'br'], ['bm', 'b']
];
const floorLinks = {
  1: [
    ['front', 'a'], ['a', 'left'], ['a', 'right'],
    ['left', 'la'], ['right', 'ra'],
    ['a', 'bottomL'], ['a', 'bottomR'],
    ['left', 'bl'], ['right', 'br'],
    ['bl', 'bLeft1'], ['bLeft1', 'bm'],
    ['bm', 'bRight1'], ['bRight1', 'br'], ['bm', 'b']
  ],
  2: baseLinks.map(pair => [...pair]),
  3: baseLinks.map(pair => [...pair]),
  4: baseLinks.map(pair => [...pair])
};

// (4) The two QR-code locations. BOTH are on floor 1.
// Edit these AFTER physically checking where the QR signs are mounted.
const qrLocations = {
  a: { floor: 1, node: 'front', label: 'ทางเข้า Zone A ชั้น 1' },
  b: { floor: 1, node: 'b', label: 'ทางเข้า Zone B ชั้น 1' }
};

// (5) Existing room data, still approximate. Do not mistake these
// points for verified door coordinates.
const roomSpecs = [];
function add(f, ids, x0, x1, y, anchor) {
  ids.forEach((id, i) => roomSpecs.push({
    id: 'SC' + f + String(id).padStart(3, '0'),
    floor: f,
    x: ids.length === 1 ? x0 : x0 + (x1 - x0) * i / (ids.length - 1),
    y,
    anchor
  }));
}
add(1,[17,18,19,20],345,176,540,'la');add(1,[23,24,25,26],180,346,402,'la');add(1,[41,42,43,44],1110,944,542,'ra');add(1,[45,46,47,48],945,1111,402,'ra');add(1,[11,12,13,14,15,16],429,545,616,'bottomL');add(1,[49,50,51],801,897,620,'bottomR');add(1,[1,2],496,375,777,'bottomL');add(1,[58,59],782,899,782,'bottomR');add(1,[63,62],534,535,151,'bl');add(1,[64,65,66,67,68],747,933,175,'br');
add(2,[7,8,9,10],297,77,649,'la');add(2,[13,14,15,16],74,281,477,'la');add(2,[31,32,33,34],1212,1021,646,'ra');add(2,[25,26,27,28],1022,1213,482,'ra');add(2,[41,42,43,44,47,48,49,50],363,285,271,'bl');add(2,[53,54,55,56,59,60,61,62],821,933,263,'br');add(2,[1,2,3],509,509,707,'bottomL');add(2,[37,38,39,40],895,793,719,'bottomR');add(2,[51,52],532,752,174,'bm');
add(3,[10,11,12],281,75,652,'la');add(3,[15,16,17],75,283,485,'la');add(3,[37,38,39],1212,1032,655,'ra');add(3,[32,33,34],1041,1198,485,'ra');add(3,[40,41,42,43,46,47],357,302,280,'bl');add(3,[51,52,53,56,57,58,59],872,1021,282,'br');add(3,[5,6,4],645,803,770,'bottomR');add(3,[18,19,20],385,530,618,'bottomL');add(3,[23,30,31],785,904,618,'bottomR');add(3,[49,50],543,755,170,'bm');
add(4,[4,5,6],285,82,700,'la');add(4,[9,10,11],83,280,534,'la');add(4,[28,29,30],1202,1047,705,'ra');add(4,[23,24,25],1043,1207,538,'ra');add(4,[31,32,35,36,37],316,555,268,'bl');add(4,[38,39,40,43,44],738,992,278,'br');add(4,[1],463,463,670,'bottomL');add(4,[20],822,822,670,'bottomR');
const rooms = new Map(roomSpecs.map(room => [room.id, room]));

// (6) HTML elements and UI state.
const startEl = document.querySelector('#start');
const roomEl = document.querySelector('#room');
const statusEl = document.querySelector('#status');
const locationStatusEl = document.querySelector('#locationStatus');
const floorImg = document.querySelector('#floorImage');
const overlay = document.querySelector('#overlay');
const routeLayer = document.querySelector('#routeLayer');
const positionLayer = document.querySelector('#positionLayer');
const stepsEl = document.querySelector('#steps');
const floorHelpEl = document.querySelector('#floorHelp');

let floor = 1;
let lastRoute = null;
let positionActive = false;
let positionSource = 'none'; // 'none', 'qr', or 'manual'

// These will be updated when each image loads. If you replace 1.jpg
// with a resized 1448x1086 copy, SVG uses the new image dimensions.
// WARNING: resizing can be scaled; cropping / repositioning cannot
// be fixed automatically and needs geometry calibration by hand.
const imageSizes = {
  1: [referenceWidth, referenceHeights[1]],
  2: [referenceWidth, referenceHeights[2]],
  3: [referenceWidth, referenceHeights[3]],
  4: [referenceWidth, referenceHeights[4]]
};

const params = new URLSearchParams(window.location.search);
const scannedStart = params.get('start');
if (Object.hasOwn(qrLocations, scannedStart)) {
  startEl.value = scannedStart;
  positionActive = true;
  positionSource = 'qr';
}
if (params.get('room')) roomEl.value = params.get('room').toUpperCase();

for (const id of [...rooms.keys()].sort()) {
  const opt = document.createElement('option');
  opt.value = id;
  document.querySelector('#roomList').append(opt);
}

const tabs = document.querySelector('#floorTabs');
for (let f = 1; f <= 4; f++) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `ชั้น ${f}`;
  button.dataset.floor = String(f);
  button.addEventListener('click', () => showFloor(f));
  tabs.append(button);
}

function showFloor(nextFloor) {
  floor = nextFloor;
  const desiredSrc = `assets/${floor}.jpg`;
  // Avoid needless reloads, but draw immediately while changing floors.
  if (floorImg.getAttribute('src') !== desiredSrc) floorImg.src = desiredSrc;
  floorImg.alt = `แปลนอาคาร SC1 ชั้น ${floor}`;
  const [w, h] = imageSizes[floor];
  overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
  document.querySelectorAll('[data-floor]').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.floor) === floor);
  });
  document.querySelector('#floorNote').textContent = `ชั้น ${floor} · Zone A / Zone B`;
  draw();
}

floorImg.addEventListener('load', () => {
  imageSizes[floor] = [floorImg.naturalWidth, floorImg.naturalHeight];
  overlay.setAttribute('viewBox', `0 0 ${floorImg.naturalWidth} ${floorImg.naturalHeight}`);
  draw();
});

// (7) Convert old image points to currently displayed image coordinates.
function renderPoint(f, point) {
  const [w, h] = imageSizes[f];
  return [point[0] * w / referenceWidth, point[1] * h / referenceHeights[f]];
}

function svgTo(layer, tag, attrs, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== undefined) el.textContent = text;
  layer.append(el);
  return el;
}

function graphKey(f, node) {
  return `${f}:${node}`;
}

// (8) Dijkstra shortest-path demo based on approximate graph data.
function route(startCode, destinationId) {
  const destination = rooms.get(destinationId);
  if (!destination || !qrLocations[startCode]) return null;
  const adjacency = new Map();
  function oneWay(a, b, weight) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a).push({ to: b, weight });
  }
  function connect(a, b, weight) {
    oneWay(a, b, weight);
    oneWay(b, a, weight);
  }

  for (let f = 1; f <= 4; f++) {
    const points = geometry[f];
    for (const [a, b] of floorLinks[f]) {
      if (!points[a] || !points[b]) {
        console.warn('Missing graph node:', f, a, b);
        continue;
      }
      connect(graphKey(f, a), graphKey(f, b), Math.hypot(
        points[a][0] - points[b][0], points[a][1] - points[b][1]
      ));
    }
    // Unverified stair connections inherited from old prototype.
    if (f < 4) {
      for (const stairs of ['a', 'bl', 'br']) {
        connect(graphKey(f, stairs), graphKey(f + 1, stairs), 220);
      }
    }
  }

  const roomKey = graphKey(destination.floor, 'room');
  const anchor = geometry[destination.floor][destination.anchor];
  if (!anchor) return null;
  connect(roomKey, graphKey(destination.floor, destination.anchor),
    Math.hypot(destination.x - anchor[0], destination.y - anchor[1]));

  const qr = qrLocations[startCode];
  const source = graphKey(qr.floor, qr.node);
  const distances = new Map([[source, 0]]);
  const parents = new Map();
  const unvisited = new Set([source]);

  while (unvisited.size) {
    let current = [...unvisited].reduce((a, b) =>
      distances.get(a) <= distances.get(b) ? a : b);
    unvisited.delete(current);
    if (current === roomKey) break;
    for (const { to, weight } of adjacency.get(current) || []) {
      const alternative = distances.get(current) + weight;
      if (alternative < (distances.get(to) ?? Infinity)) {
        distances.set(to, alternative);
        parents.set(to, current);
        unvisited.add(to);
      }
    }
  }
  if (!distances.has(roomKey)) return null;
  const result = [];
  let cursor = roomKey;
  while (cursor !== undefined) {
    result.unshift(cursor);
    cursor = parents.get(cursor);
  }
  return result;
}

function coordinateForRoute(key) {
  const [fStr, node] = key.split(':');
  const f = Number(fStr);
  if (node === 'room') {
    const room = rooms.get(roomEl.value.toUpperCase().trim());
    return renderPoint(f, [room.x, room.y]);
  }
  return renderPoint(f, geometry[f][node]);
}

// (9) The route is drawn BELOW the fixed QR blue dot.
function drawRoute() {
  routeLayer.replaceChildren();
  if (!lastRoute) return;
  const portions = [];
  let current = [];
  for (const key of lastRoute) {
    if (Number(key.split(':')[0]) === floor) {
      current.push(key);
    } else if (current.length) {
      portions.push(current);
      current = [];
    }
  }
  if (current.length) portions.push(current);
  for (const part of portions) {
    if (part.length > 1) {
      const points = part.map(key => coordinateForRoute(key).join(',')).join(' ');
      svgTo(routeLayer, 'polyline', {
        points, fill: 'none', stroke: '#fff', 'stroke-width': 17,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      });
      svgTo(routeLayer, 'polyline', {
        points, fill: 'none', stroke: '#0891b2', 'stroke-width': 9,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      });
    }
    const last = part[part.length - 1];
    if (last.endsWith(':room')) {
      const [x, y] = coordinateForRoute(last);
      svgTo(routeLayer, 'circle', {
        cx: x, cy: y, r: 15, fill: '#ea580c', stroke: '#fff', 'stroke-width': 4
      });
    }
  }
}

// (10) The new feature: blue dot at the LAST SCANNED QR point.
// It is deliberately only shown on floor 1, since both QR signs are there.
function drawBlueDot() {
  positionLayer.replaceChildren();
  if (!positionActive) return;
  const qr = qrLocations[startEl.value];
  if (floor !== qr.floor) return;
  const originalPoint = geometry[qr.floor][qr.node];
  // Tracker stores estimated coordinates in the original 1284px map system.
  // It never pretends the position is verified; otherwise show the last QR.
  const estimate = window.SC1PDR?.getPosition();
  const [x, y] = renderPoint(qr.floor, estimate ?? originalPoint);

  // Pale halo makes the dot visible over dark lines in floor plan.
  svgTo(positionLayer, 'circle', {
    cx: x, cy: y, r: 32, fill: '#2563eb', 'fill-opacity': 0.14
  });
  svgTo(positionLayer, 'circle', {
    cx: x, cy: y, r: 15, fill: '#2563eb', stroke: '#ffffff', 'stroke-width': 5
  });
  svgTo(positionLayer, 'text', {
    x: x + 22, y: y - 16, fill: '#1d4ed8',
    'font-size': 21, 'font-weight': 'bold',
    stroke: '#fff', 'stroke-width': 5, 'paint-order': 'stroke'
  }, estimate ? 'ตำแหน่งประมาณ' : 'จุด QR');
}

function renderLocationStatus() {
  if (!positionActive) {
    locationStatusEl.textContent = 'ยังไม่ได้สแกน QR หรือเลือกจุดเริ่มต้น';
  } else {
    const label = qrLocations[startEl.value].label;
    locationStatusEl.textContent = positionSource === 'qr'
      ? `📍 ตำแหน่งเริ่มต้นจาก QR: ${label} · หากเปิดโหมดเซนเซอร์ จุดสีน้ำเงินจะเป็นเพียงตำแหน่งประมาณ`
      : `📍 จุดเริ่มต้นที่เลือกเอง: ${label} · จุดสีน้ำเงินไม่ติดตามการเดินจริง`;
  }
  floorHelpEl.textContent = positionActive && floor !== 1
    ? 'ตำแหน่งทดลองอ้างอิงชั้น 1 เท่านั้น และไม่สามารถตรวจการขึ้นลงชั้นได้อัตโนมัติ'
    : '';
}

function draw() {
  drawRoute();
  drawBlueDot();
  renderLocationStatus();
  window.SC1Session?.save();
}

function calculate() {
  const room = roomEl.value.toUpperCase().replace(/\s+/g, '');
  roomEl.value = room;
  if (!rooms.has(room)) {
    statusEl.textContent = 'ไม่พบรหัสห้องนี้ในชุดข้อมูลต้นแบบ กรุณาเลือกรหัสจากรายการ';
    stepsEl.replaceChildren();
    lastRoute = null;
    draw();
    return;
  }
  if (!positionActive) {
    // Allow testing without a physical QR, but clearly label it manual.
    positionActive = true;
    positionSource = 'manual';
  }
  lastRoute = route(startEl.value, room);
  if (!lastRoute) {
    statusEl.textContent = 'ยังไม่พบเส้นทางในข้อมูล Graph ของต้นแบบ';
    stepsEl.replaceChildren();
    draw();
    return;
  }
  const target = rooms.get(room);
  statusEl.textContent = `พบห้อง ${room} ชั้น ${target.floor} · เส้นทางยังเป็นข้อมูลประมาณ ไม่ใช่เส้นทางที่ตรวจสอบจริง`;
  showFloor(1);

  const instructions = [
    `เริ่มจาก${qrLocations[startEl.value].label}`,
    'เดินตามเส้นทางสีฟ้าเขียวบนผัง (ยังไม่ได้ตรวจสอบหน้างาน)'
  ];
  for (let i = 1; i < lastRoute.length; i++) {
    const before = lastRoute[i - 1].split(':');
    const after = lastRoute[i].split(':');
    if (before[0] !== after[0]) {
      instructions.push(`เปลี่ยนจากชั้น ${before[0]} ไปชั้น ${after[0]} (ตำแหน่งบันไดยังไม่ยืนยัน)`);
    }
  }
  instructions.push(`ไปยังห้อง ${room} ชั้น ${target.floor} (ตำแหน่งประตูต้องตรวจสอบ)`);
  stepsEl.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = 'เส้นทางตัวอย่าง';
  stepsEl.append(heading);
  const list = document.createElement('ol');
  instructions.forEach(line => {
    const item = document.createElement('li');
    item.textContent = line;
    list.append(item);
  });
  stepsEl.append(list);
  if (target.floor !== 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `ดูเส้นทางชั้น ${target.floor}`;
    btn.addEventListener('click', () => showFloor(target.floor));
    stepsEl.append(btn);
  }
}

// (11) QR links: URL search parameter is all that's needed. No camera SDK.
function activateStart(zone, source) {
  if (!Object.hasOwn(qrLocations, zone)) return;
  window.SC1PDR?.reset(zone);
  startEl.value = zone;
  positionActive = true;
  positionSource = source;
  showFloor(1);
  if (lastRoute) calculate();
  else statusEl.textContent = `กำหนดจุดเริ่มต้น ${qrLocations[zone].label} แล้ว`;
}

function makeQrLink(zone) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('start', zone);
  url.hash = '';
  return url.toString();
}

async function copyQrLink(zone) {
  const link = makeQrLink(zone);
  if (!/^https?:\/\//.test(link)) {
    statusEl.textContent = 'ทดสอบด้วยปุ่มจำลองได้ แต่ต้องเผยแพร่เว็บไซต์ก่อนสร้าง QR ให้โทรศัพท์สแกนได้';
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    statusEl.textContent = `คัดลอกลิงก์ Zone ${zone.toUpperCase()} แล้ว`;
  } catch {
    window.prompt('คัดลอกลิงก์นี้:', link);
  }
}

// (12) Button events.
document.querySelector('#simulateA').addEventListener('click', () => activateStart('a', 'qr'));
document.querySelector('#simulateB').addEventListener('click', () => activateStart('b', 'qr'));
startEl.addEventListener('change', () => activateStart(startEl.value, 'manual'));
document.querySelector('#routeBtn').addEventListener('click', calculate);
roomEl.addEventListener('keydown', event => { if (event.key === 'Enter') calculate(); });
document.querySelector('#clearBtn').addEventListener('click', () => {
  lastRoute = null;
  roomEl.value = '';
  stepsEl.replaceChildren();
  statusEl.textContent = 'ล้างเส้นทางแล้ว (ยังคงจุดเริ่มต้นล่าสุดไว้)';
  draw();
});
for (const zone of ['a', 'b']) {
  document.querySelector('#copy' + zone.toUpperCase()).addEventListener('click',
    () => copyQrLink(zone));
  document.querySelector('#link' + zone.toUpperCase()).href = makeQrLink(zone);
}

showFloor(1);
if (roomEl.value.trim()) calculate();
