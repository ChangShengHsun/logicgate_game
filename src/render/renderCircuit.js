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

  slots.forEach((s, idx) => {
  // ✅ 如果題目有指定位置，就用題目指定的 col/row
  // 否則 fallback 回原本的 idx grid 排法
  const col = Number.isInteger(s.col) ? s.col : (idx % cfg.columns);
  const row = Number.isInteger(s.row) ? s.row : Math.floor(idx / cfg.columns);

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
  el.innerHTML = `<div class="blankBox" title="slot ${s.id}"></div>`;
  nodeLayer.appendChild(el);
});


  // SVG size
  resizeSvgToFit(stage, svg, nodePos);

    // Compute a routing channel above all nodes
  const allBounds = (() => {
    let minY = Infinity;
    for (const r of nodePos.values()) minY = Math.min(minY, r.y);
    return { top: Math.max(20, minY - 40) };
  })();

  let wireIndex = 0;

  // Draw L wires for all connections
  for (const s of slots) {
    const dst = nodePos.get(s.id);
    if (!dst || !Array.isArray(s.in)) continue;

    s.in.forEach((srcId, k) => {
      const src = nodePos.get(srcId);
      if (!src) return;

      const start = rightMid(src);
      const end = leftPort(dst, s.in.length, k);

      // Unique lane + unique stubX for each wire => avoid overlap
      const laneY = allBounds.top - wireIndex * 14;         // lane gap
      const stubX = start.x + 18 + wireIndex * 10;          // stub gap

      drawLWire(svg, start, end);

      wireIndex += 1;
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
    const p2 = { x: outBox.x - outBox.w/2, y: outBox.y + outBox.h / 2 };
    drawLWire(svg, p1, p2);

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

function rightMid(n) { return { x: n.x + n.w*0.85, y: n.y + n.h / 2 }; }

function leftPort(n, totalPorts, idx) {
  if (totalPorts <= 1) return { x: n.x, y: n.y + n.h / 2 };
  const topPad = 25;
  const usable = n.h - topPad * 2;
  const step = usable / (totalPorts - 1);
  return { x: n.x, y: n.y + topPad + idx * step };
}

function drawLWire(svg, start, end, pad = 10) {
  const nearEndX = end.x - pad;

  const pts = [
    { x: start.x,  y: start.y },
    { x: nearEndX, y: start.y }, // horizontal
    { x: nearEndX, y: end.y },   // vertical
    { x: end.x + 28,    y: end.y }    // final short horizontal into the port
  ];

  const p = pts.map(v => `${v.x},${v.y}`).join(" ");
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute("points", p);
  poly.setAttribute("class", "wire");
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke-linejoin", "round");
  poly.setAttribute("stroke-linecap", "round");
  svg.appendChild(poly);
}


function drawOrthogonalNoOverlap(svg, start, end, laneY, stubX) {
  // points: start -> stub -> lane -> nearEnd -> end
  const nearEndX = end.x - 10;

  const pts = [
    { x: start.x, y: start.y },
    { x: stubX,   y: start.y },
    { x: stubX,   y: laneY },
    { x: nearEndX,y: laneY },
    { x: nearEndX,y: end.y },
    { x: end.x,   y: end.y },
  ];

  const p = pts.map(v => `${v.x},${v.y}`).join(" ");
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute("points", p);
  poly.setAttribute("class", "wire");
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke-linejoin", "round");
  poly.setAttribute("stroke-linecap", "round");
  svg.appendChild(poly);
}
