// src/render/renderCircuit.js

export function renderCircuit(question, container, options = {}) {
  const cfg = {
    columns: 3,
    slotWidth: 180,
    slotHeight: 90,
    hGap: 110,
    vGap: 55,
    inputX: 40,
    inputStartY: 110,
    inputGapY: 72,
    ...options,
  };

  container.innerHTML = "";
  container.classList.add("circuitRoot");

  const stage = document.createElement("div");
  stage.className = "circuitStage";
  container.appendChild(stage);

  // SVG layer for wires
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "wireLayer");
  stage.appendChild(svg);

  // Node layer
  const nodeLayer = document.createElement("div");
  nodeLayer.className = "nodeLayer";
  stage.appendChild(nodeLayer);

  const inputsObj = (question.inputs && typeof question.inputs === "object" && !Array.isArray(question.inputs))
    ? question.inputs
    : {};
  const inputs = normalizeInputs(question); // ["A","B","C"...]
  const slots = question.slots ?? [];

  const nodePos = new Map(); // id -> {x,y,w,h}

  // ---- Inputs: show only 0/1 ----
  inputs.forEach((name, i) => {
    const x = cfg.inputX;
    const y = cfg.inputStartY + i * cfg.inputGapY;
    nodePos.set(name, { x, y, w: 64, h: 64, type: "input" });

    const val = (name in inputsObj) ? Number(inputsObj[name]) : "?";

    const el = document.createElement("div");
    el.className = "node inputNode";
    el.dataset.nodeId = name;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `64px`;
    el.style.height = `64px`;
    el.innerHTML = `<div class="bit">${val}</div>`;
    nodeLayer.appendChild(el);
  });

  // ---- Slots: only a red rectangle blank ----
  slots.forEach((s, idx) => {
    const col = idx % cfg.columns;
    const row = Math.floor(idx / cfg.columns);

    const x = cfg.inputX + 150 + col * (cfg.slotWidth + cfg.hGap);
    const y = cfg.inputStartY - 10 + row * (cfg.slotHeight + cfg.vGap);

    nodePos.set(s.id, {
      x, y, w: cfg.slotWidth, h: cfg.slotHeight,
      type: "slot",
      arity: s.arity,
      in: s.in
    });

    const el = document.createElement("div");
    el.className = "node slotNode";
    el.dataset.nodeId = s.id;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${cfg.slotWidth}px`;
    el.style.height = `${cfg.slotHeight}px`;

    // 只留紅框空格（之後 gate 會被你放到這個框框內）
    el.innerHTML = `<div class="blankBox" title="slot ${s.id}"></div>`;
    nodeLayer.appendChild(el);
  });

  // SVG size
  resizeSvgToFit(stage, svg, nodePos);

  // Wires: from each source in slot.in -> this slot
  for (const s of slots) {
    const dst = nodePos.get(s.id);
    if (!dst || !Array.isArray(s.in)) continue;

    s.in.forEach((srcId, k) => {
      const src = nodePos.get(srcId);
      if (!src) return;

      const p1 = rightMid(src);
      const p2 = leftPort(dst, s.in.length, k);
      drawBezier(svg, p1.x, p1.y, p2.x, p2.y);
    });
  }

    // Output box (show 1/0/?)
  if (question.output && nodePos.has(question.output)) {
    const out = nodePos.get(question.output);

    // place OUT box to the right of output slot
    const outBoxId = "__OUT__";
    const outBox = {
      x: out.x + out.w + 120,
      y: out.y + out.h / 2 - 32,
      w: 64,
      h: 64,
      type: "out"
    };
    nodePos.set(outBoxId, outBox);

    // draw wire from output slot to OUT box
    const p1 = rightMid(out);
    const p2 = { x: outBox.x, y: outBox.y + outBox.h / 2 };
    drawBezier(svg, p1.x, p1.y, p2.x, p2.y);

    // render OUT node (default '?')
    const outEl = document.createElement("div");
    outEl.className = "node outNode";
    outEl.dataset.nodeId = outBoxId;
    outEl.style.left = `${outBox.x}px`;
    outEl.style.top = `${outBox.y}px`;
    outEl.style.width = `${outBox.w}px`;
    outEl.style.height = `${outBox.h}px`;
    outEl.innerHTML = `<div class="bit">?</div>`;
    nodeLayer.appendChild(outEl);
  }

  return { nodePos };
}

/* ---------------- helpers ---------------- */

function normalizeInputs(question) {
  if (Array.isArray(question.inputs)) return question.inputs;
  if (question.inputs && typeof question.inputs === "object") return Object.keys(question.inputs);

  const slotIds = new Set((question.slots ?? []).map(s => s.id));
  const ins = new Set();
  for (const s of (question.slots ?? [])) {
    for (const x of (s.in ?? [])) if (!slotIds.has(x)) ins.add(x);
  }
  return Array.from(ins);
}

function resizeSvgToFit(stage, svg, nodePos) {
  let maxX = 0, maxY = 0;
  for (const v of nodePos.values()) {
    maxX = Math.max(maxX, v.x + v.w + 200);
    maxY = Math.max(maxY, v.y + v.h + 160);
  }
  stage.style.minHeight = `${maxY}px`;
  stage.style.minWidth = `${maxX}px`;
  svg.setAttribute("width", maxX);
  svg.setAttribute("height", maxY);
  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
}

function rightMid(n) { return { x: n.x + n.w, y: n.y + n.h / 2 }; }

function leftPort(n, totalPorts, idx) {
  if (totalPorts <= 1) return { x: n.x, y: n.y + n.h / 2 };
  const topPad = 16;
  const usable = n.h - topPad * 2;
  const step = usable / (totalPorts - 1);
  return { x: n.x, y: n.y + topPad + idx * step };
}

function drawBezier(svg, x1, y1, x2, y2) {
  const dx = Math.max(50, (x2 - x1) * 0.45);
  const c1x = x1 + dx, c1y = y1;
  const c2x = x2 - dx, c2y = y2;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
  path.setAttribute("class", "wire");
  svg.appendChild(path);
}

function drawArrow(svg, x1, y1, x2, y2) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("class", "wire");
  svg.appendChild(line);

  const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const size = 8;
  head.setAttribute("d", `M ${x2} ${y2} L ${x2 - size} ${y2 - size/2} L ${x2 - size} ${y2 + size/2} Z`);
  head.setAttribute("class", "wireArrow");
  svg.appendChild(head);
}

function drawLabel(svg, x, y, text) {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("class", "wireLabel");
  t.textContent = text;
  svg.appendChild(t);
}
