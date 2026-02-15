import { renderCircuit } from "./render/renderCircuit.js";
import { getAssignment, initGatePalette, enableSlotDrops, resetAssignment } from "./render/drag.js";

// 你目前 question 資料夾下的題目檔案
const LEVEL_FILES = [
  "./src/question/test.json",
  "./src/question/test2.json",
  "./src/question/test3.json",
  "./src/question/test4.json",
  "./src/question/test5.json",
  "./src/question/test6.json",
  "./src/question/test7.json",
  "./src/question/test8.json",
  "./src/question/test9.json",
  "./src/question/test10.json",
];
const ALL_GATES = ["buffer", "not", "and", "or", "xor", "nand", "nor", "xnor"];

async function loadQuestion(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  return await res.json();
}

function buildLevelBar(container, levelCount, onPick) {
  container.innerHTML = "";
  const btns = [];

  for (let i = 0; i < levelCount; i++) {
    const btn = document.createElement("div");
    btn.className = "levelBtn";
    btn.textContent = String(i + 1);
    btn.addEventListener("click", () => onPick(i));
    container.appendChild(btn);
    btns.push(btn);
  }

  const setActive = (idx) => {
    btns.forEach((b, i) => b.classList.toggle("active", i === idx));
  };

  return { setActive };
}

async function main() {
  const board = document.getElementById("board");
  const info = document.getElementById("info");
  const levelBar = document.getElementById("levelBar");
  const gateBar = document.getElementById("gateBar");
  
  initTruthTable();


  const { setActive } = buildLevelBar(levelBar, LEVEL_FILES.length, async (idx) => {
    try {
      setActive(idx);
      info.textContent = `Loading level ${idx + 1}...`;

      const q = await loadQuestion(LEVEL_FILES[idx]);
      applyQuestion(q, board, gateBar);


      info.textContent = `Level ${idx + 1}: ${q.id ?? "unknown"}`;
    } catch (err) {
      console.error(err);
      info.textContent = `Error: ${err.message}`;
      board.innerHTML = `<div style="padding:12px;opacity:.9">
        <b>載入失敗：</b>${err.message}<br>
        檢查檔案是否存在：<code>${LEVEL_FILES[idx]}</code>
      </div>`;
    }
  });

  // 預設載入第 1 關
  setActive(0);
  const q0 = await loadQuestion(LEVEL_FILES[0]);
  applyQuestion(q0, board, gateBar);

  info.textContent = `Level 1: ${q0.id ?? "unknown"}`;
}

main().catch(err => {
  console.error(err);
  const info = document.getElementById("info");
  info.textContent = `Error: ${err.message}`;
});

/* ---------------------helper functions--------------------- */
function initTruthTable() {
  const btn = document.getElementById("truthBtn");
  const overlay = document.getElementById("truthOverlay");
  const close = document.getElementById("truthClose");
  if (!btn || !overlay || !close) return;

  const open = () => {
    overlay.classList.add("isOpen");
    overlay.setAttribute("aria-hidden", "false");
  };
  const hide = () => {
    overlay.classList.remove("isOpen");
    overlay.setAttribute("aria-hidden", "true");
  };

  btn.addEventListener("click", open);
  close.addEventListener("click", hide);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) hide();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("isOpen")) hide();
  });
}

function renderGateBar(container, gates = ALL_GATES) {
  container.innerHTML = "";

  for (const g of gates) {
    const el = document.createElement("div");
    el.className = "gateCard";
    el.dataset.gate = g;

    // 圖片覆蓋整張卡
    const img = document.createElement("img");
    img.className = "gateImg";
    img.src = `./img/${g}.png`;
    img.alt = g;

    el.appendChild(img);

    const count = document.createElement("div");
    count.className = "gateCount";
    el.appendChild(count);

    // 你還想保留文字 debug（可選）
    // const label = document.createElement("div");
    // label.className = "gateLabel";
    // label.textContent = g;
    // el.appendChild(label);

    container.appendChild(el);
  }
}

function applyQuestion(question, board, gateBar) {
  resetAssignment();
  const gateConfig = resolveGateConfig(question);

  renderGateBar(gateBar, gateConfig.gates);
  initGatePalette(gateBar);

  renderCircuit(question, board, { columns: 3 });
  const outBitEl = document.getElementById("outBit");
  const updateCounts = (assignment) => {
    updateGateBarCounts(gateBar, gateConfig.limits, assignment);
  };
  updateCounts(getAssignment());

  enableSlotDrops(board, {
    question,
    outBitEl,
    accept: buildGateAccept(gateConfig.limits),
    onChange: updateCounts,
  });
}

function resolveGateConfig(question) {
  const fromCounts = parseGateCounts(question?.gateCounts);
  if (fromCounts) return fromCounts;

  const fromAllowed = parseAllowedGates(question?.allowedGates);
  if (fromAllowed) return fromAllowed;

  const limits = {};
  for (const gate of ALL_GATES) limits[gate] = Infinity;
  return { gates: ALL_GATES, limits };
}

function parseGateCounts(gateCounts) {
  if (!gateCounts || typeof gateCounts !== "object" || Array.isArray(gateCounts)) return null;

  const gates = [];
  const limits = {};
  for (const [rawGate, rawLimit] of Object.entries(gateCounts)) {
    const gate = normalizeGateName(rawGate);
    if (!gate || !ALL_GATES.includes(gate)) continue;

    const limit = Number(rawLimit);
    if (!Number.isFinite(limit) || limit < 0) continue;

    gates.push(gate);
    limits[gate] = Math.floor(limit);
  }

  return gates.length ? { gates, limits } : null;
}

function parseAllowedGates(allowedGates) {
  if (!Array.isArray(allowedGates)) return null;

  const gates = [];
  const limits = {};
  const seen = new Set();
  for (const rawGate of allowedGates) {
    const gate = normalizeGateName(rawGate);
    if (!gate || !ALL_GATES.includes(gate) || seen.has(gate)) continue;
    seen.add(gate);
    gates.push(gate);
    limits[gate] = Infinity;
  }

  return gates.length ? { gates, limits } : null;
}

function buildGateAccept(gateLimits) {
  const hasLimits = gateLimits && Object.keys(gateLimits).length > 0;
  return (slotId, gate) => {
    if (!hasLimits) return true;

    const normalized = normalizeGateName(gate);
    if (!normalized || gateLimits[normalized] === undefined) return false;

    const limit = gateLimits[normalized];
    if (!Number.isFinite(limit)) return true;

    const assignment = getAssignment();
    const usedCounts = countUsedGates(assignment);
    let used = usedCounts[normalized] || 0;

    const current = normalizeGateName(assignment[slotId]);
    if (current === normalized) used = Math.max(used - 1, 0);

    return limit - used > 0;
  };
}

function updateGateBarCounts(container, gateLimits, assignment) {
  const limits = gateLimits || {};
  const usedCounts = countUsedGates(assignment);
  const cards = container.querySelectorAll(".gateCard");

  cards.forEach((card) => {
    const gate = normalizeGateName(card.dataset.gate);
    const limit = limits[gate];
    const countEl = card.querySelector(".gateCount");
    if (!countEl) return;

    if (limit === undefined || !Number.isFinite(limit)) {
      countEl.textContent = "";
      countEl.classList.add("isHidden");
      card.dataset.remaining = "";
      card.classList.remove("isZero");
      card.setAttribute("draggable", "true");
      return;
    }

    const used = usedCounts[gate] || 0;
    const remaining = Math.max(limit - used, 0);
    countEl.textContent = String(remaining);
    countEl.classList.remove("isHidden");
    card.dataset.remaining = String(remaining);
    card.classList.toggle("isZero", remaining <= 0);
    card.setAttribute("draggable", remaining > 0 ? "true" : "false");
  });
}

function countUsedGates(assignment) {
  const counts = {};
  for (const gate of Object.values(assignment || {})) {
    const name = normalizeGateName(gate);
    if (!name) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

function normalizeGateName(gate) {
  return String(gate || "").trim().toLowerCase();
}
