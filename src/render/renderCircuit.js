// src/render/renderCircuit.js

/**
 * Render a slot-based circuit skeleton from JSON into container.
 * - Only visualizes: inputs, slots (as blanks), and wires.
 * - Does NOT handle drag/drop, gate placement, or evaluation.
 */
export function renderCircuit(question, container, options = {}) {
  const cfg = {
    columns: 3,           // layout columns for slots
    slotWidth: 220,
    slotHeight: 90,
    hGap: 80,
    vGap: 40,
    inputX: 40,
    inputStartY: 80,
    inputGapY: 56,
    ...options,
  };

  container.innerHTML = "";
  container.classList.add("circuitRoot");

  const title = document.createElement("div");
  title.className = "circuitTitle";
  title.textContent = question.title ?? question.id ?? "Circuit";
  container.appendChild(title);

  const stage = document.createElement("div");
  stage.className = "circuitStage";
  container.appendChild(stage);

  // SVG layer for wires (behind nodes)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "wireLayer");
  stage.appendChild(svg);

  // Node layer (inputs + slots)
  const nodeLayer = document.createElement("div");
  nodeLayer.className = "nodeLayer";
  stage.appendChild(nodeLayer);

  // --- Layout: inputs on the left, slots in a grid ---
  const inputs = normalizeInputs(question);
  const slots = question.slots ?? [];

  const nodePos = new Map(); // id -> {x,y,w,h,type:"input"|"slot", arity, in[]}

  // Place inputs
  inputs.forEach((name, i) => {
    const x = cfg.inputX;
    const y = cfg.inputStartY + i * cfg.inputGapY;
    nodePos.set(name, { x, y, w: 90, h: 36, type: "input" });

    const el = document.createElement("div");
    el.className = "node inputNode";
    el.dataset.nodeId = name;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `90px`;
    el.style.height = `36px`;
    el.innerHTML = `
      <div class="nodeName">${escapeHtml(name)}</div>
      <div class="nodeMeta">input</div>
    `;
    nodeLayer.appendChild(el);
  });

  // Place slots (simple grid)
  slots.forEach((s, idx) => {
    const col = idx % cfg.columns;
    const row = Math.floor(idx / cfg.columns);

    const x = cfg.inputX + 180 + col * (cfg.slotWidth + cfg.hGap);
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

    el.innerHTML = `
      <div class="slotHeader">
        <div class="slotId">Slot <span class="mono">${escapeHtml(s.id)}</span></div>
        <div class="pill">arity: ${Number(s.arity)}</div>
      </div>
      <div class="slotBody">
        <div class="blank">[ 空格 ]</div>
        <div class="slotIn mono">in: ${escapeHtml((s.in ?? []).join(", "))}</div>
      </div>
    `;
    nodeLayer.appendChild(el);
  });

  // After DOM is in place, size SVG to stage
  resizeSvgToFit(stage, svg, nodePos);

  // Draw wires: from each source in slot.in -> this slot
  for (const s of slots) {
    const dst = nodePos.get(s.id);
    if (!dst || !Array.isArray(s.in)) continue;

    s.in.forEach((srcId, k) => {
      const src = nodePos.get(srcId);
      if (!src) return;

      const p1 = rightMid(src);
      // spread multiple inputs on left side of slot
      const p2 = leftPort(dst, s.in.length, k);

      drawBezier(svg, p1.x, p1.y, p2.x, p2.y);
    });
  }

  // Output marker (optional)
  if (question.output && nodePos.has(question.output)) {
    const out = nodePos.get(question.output);
    const p = rightMid(out);
    drawArrow(svg, p.x, p.y, p.x + 80, p.y);
    drawLabel(svg, p.x + 84, p.y + 4, "OUT");
  }

  return {
    nodePos,
    rerender: () => renderCircuit(question, container, options),
  };
}

/* ---------------- helpers ---------------- */

function normalizeInputs(question) {
  // support: inputs: ["A","B"] or inputs: {A:1,B:0}
  if (Array.isArray(question.inputs)) return question.inputs;
  if (question.inputs && typeof question.inputs === "object") return Object.keys(question.inputs);
  // fallback: collect from slot.in where it is not another slot id
  const slotIds = new Set((question.slots ?? []).map(s => s.id));
  const ins = new Set();
  for (const s of (question.slots ?? [])) {
    for (const x of (s.in ?? [])) {
      if (!slotIds.has(x)) ins.add(x);
    }
  }
  return Array.from(ins);
}

function resizeSvgToFit(stage, svg, nodePos) {
  // compute bounds
  let maxX = 0, maxY = 0;
  for (const v of nodePos.values()) {
    maxX = Math.max(maxX, v.x + v.w + 140);
    maxY = Math.max(maxY, v.y + v.h + 120);
  }
  stage.style.minHeight = `${maxY}px`;
  stage.style.minWidth = `${maxX}px`;
  svg.setAttribute("width", maxX);
  svg.setAttribute("height", maxY);
  svg.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
}

function rightMid(n) {
  return { x: n.x + n.w, y: n.y + n.h / 2 };
}

function leftPort(n, totalPorts, idx) {
  if (totalPorts <= 1) return { x: n.x, y: n.y + n.h / 2 };
  const topPad = 22;
  const usable = n.h - topPad - 18;
  const step = usable / (totalPorts - 1);
  return { x: n.x, y: n.y + topPad + idx * step };
}

function drawBezier(svg, x1, y1, x2, y2) {
  const dx = Math.max(40, (x2 - x1) * 0.5);
  const c1x = x1 + dx, c1y = y1;
  const c2x = x2 - dx, c2y = y2;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
  path.setAttribute("class", "wire");
  svg.appendChild(path);

  // small dot at destination
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", x2);
  dot.setAttribute("cy", y2);
  dot.setAttribute("r", 3.2);
  dot.setAttribute("class", "wireDot");
  svg.appendChild(dot);
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
  const size = 7;
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[m]));
}
