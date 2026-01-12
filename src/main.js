import { renderCircuit } from "./render/renderCircuit.js";
import { initGatePalette, enableSlotDrops, resetAssignment} from "./render/drag.js";

// 你目前 question 資料夾下的題目檔案
const LEVEL_FILES = [
  "./src/question/test.json",
  "./src/question/test2.json",
  "./src/question/test3.json",
];

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

  renderGateBar(gateBar);
  initGatePalette(gateBar);
  


  const { setActive } = buildLevelBar(levelBar, LEVEL_FILES.length, async (idx) => {
    try {
      setActive(idx);
      info.textContent = `Loading level ${idx + 1}...`;

      const q = await loadQuestion(LEVEL_FILES[idx]);
      resetAssignment();
      renderCircuit(q, board, { columns: 3 });
      const outBitEl = document.getElementById("outBit");
    enableSlotDrops(board, {
        question: q,
        outBitEl,
    });


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
  resetAssignment();
  renderCircuit(q0, board, { columns: 3 });
  const outBitEl = document.getElementById("outBit");

    enableSlotDrops(board, {
    question: q0,
    outBitEl,
    });

  info.textContent = `Level 1: ${q0.id ?? "unknown"}`;
}

main().catch(err => {
  console.error(err);
  const info = document.getElementById("info");
  info.textContent = `Error: ${err.message}`;
});

/* ---------------------helper functions--------------------- */
function renderGateBar(container) {
  const gates = ["buffer","not","and","or","xor","nand","nor","xnor"];
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

    // 你還想保留文字 debug（可選）
    // const label = document.createElement("div");
    // label.className = "gateLabel";
    // label.textContent = g;
    // el.appendChild(label);

    container.appendChild(el);
  }
}

