const DATA_URL = "./data.json";
const SPIN_TIME = 3;
const POINTER_ANGLE_DEG = -90;

const wheel = document.getElementById("wheel");
const spinBtn = document.getElementById("spinBtn");
const resultEl = document.getElementById("result");

let items = [];
let probs = [];
let colors = [];
let currentRotation = 0;
let spinning = false;
let segments = [];

init().catch((err) => {
  console.error(err);
  resultEl.textContent = `Result: Error loading data`;
});

async function init() {
  const data = await loadData(DATA_URL);
  const payload = normalizePayload(data);
  if (payload.name.length !== payload.prob.length) {
    throw new Error("name/prob length mismatch");
  }
  items = payload.name;
  probs = normalizeProbabilities(payload.prob);
  colors = resolveColors(payload.color, items.length);

  segments = buildSegments(probs);
  drawWheel(items, colors, segments);
}

function loadData(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return res.json();
  });
}

function normalizePayload(data) {
  if (data && data.item1 && Array.isArray(data.item1.name) && Array.isArray(data.item1.prob)) {
    return data.item1;
  }
  if (data && Array.isArray(data.name) && Array.isArray(data.prob)) {
    return data;
  }
  throw new Error("Invalid data.json format");
}

function normalizeProbabilities(raw) {
  const nums = raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
  if (nums.length !== raw.length) throw new Error("Invalid probabilities");
  const total = nums.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("Probabilities sum to zero");
  return nums.map((n) => n / total);
}

function buildColors(n) {
  const palette = [];
  for (let i = 0; i < n; i++) {
    const hue = Math.round((360 / n) * i);
    palette.push(`hsl(${hue}, 70%, 55%)`);
  }
  return palette;
}

function resolveColors(rawColors, count) {
  if (rawColors === undefined || rawColors === null) return buildColors(count);
  if (!Array.isArray(rawColors)) throw new Error("Invalid color format");
  if (rawColors.length !== count) throw new Error("color length mismatch");

  const palette = rawColors.map((c) => String(c).trim());
  if (palette.some((c) => c.length === 0)) throw new Error("Invalid color value");
  return palette;
}

function drawWheel(names, palette, segmentDefs) {
  const ctx = wheel.getContext("2d");
  const size = wheel.width;
  const center = size / 2;
  const radius = center - 8;

  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < names.length; i++) {
    const seg = segmentDefs[i];
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, seg.startRad, seg.endRad);
    ctx.closePath();
    ctx.fillStyle = palette[i];
    ctx.fill();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(seg.centerRad);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0b1120";
    ctx.font = "bold 16px Segoe UI";
    ctx.fillText(names[i], radius - 16, 6);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(center, center, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#0b1120";
  ctx.fill();
}

spinBtn.addEventListener("click", () => {
  if (spinning || items.length === 0) return;
  const index = weightedPick(probs);
  const pointerAngleDeg = POINTER_ANGLE_DEG;
  const seg = segments[index];
  const spanDeg = seg.endDeg - seg.startDeg;
  const margin = Math.min(8, spanDeg * 0.12);
  const minDeg = seg.startDeg + margin;
  const maxDeg = seg.endDeg - margin;
  const targetDeg = minDeg + Math.random() * Math.max(1, maxDeg - minDeg);
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const targetOffset = pointerAngleDeg - targetDeg - currentMod;
  const spins = 5 + Math.floor(Math.random() * 4);
  const delta = spins * 360 + targetOffset;
  const finalRotation = currentRotation + delta;

  spinning = true;
  spinBtn.disabled = true;
  wheel.style.transition = `transform ${SPIN_TIME}s cubic-bezier(.2,.9,.2,1)`;
  wheel.style.transform = `rotate(${finalRotation}deg)`;
  currentRotation = finalRotation;

  setTimeout(() => {
    resultEl.textContent = `Result: ${items[index]}`;
    spinning = false;
    spinBtn.disabled = false;
  }, SPIN_TIME * 1000);
});

function weightedPick(weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r <= acc) return i;
  }
  return weights.length - 1;
}

function buildSegments(weights) {
  const defs = [];
  const startDeg = -90;
  let accDeg = 0;
  for (const w of weights) {
    const spanDeg = w * 360;
    const segStartDeg = startDeg + accDeg;
    const segEndDeg = segStartDeg + spanDeg;
    const centerDeg = segStartDeg + spanDeg / 2;
    defs.push({
      startDeg: segStartDeg,
      endDeg: segEndDeg,
      centerDeg,
      startRad: degToRad(segStartDeg),
      endRad: degToRad(segEndDeg),
      centerRad: degToRad(centerDeg),
    });
    accDeg += spanDeg;
  }
  return defs;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}
