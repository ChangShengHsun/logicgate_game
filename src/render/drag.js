// src/render/drag.js
// Drag-and-drop for gate palette -> slot blank boxes
// - Palette is infinite supply (drag copies)
// - Drop replaces existing gate in that slot
// - Double click on a slot to clear
// - Maintains assignment map: { slotId: gateName }
import { evaluate } from "../engine/check.js";
const MIME = "application/x-logic-gate";
const GATE_ARITY = {
  buffer: 1,
  not: 1,
  and: 2,
  or: 2,
  xor: 2,
  nand: 2,
  nor: 2,
  xnor: 2
};

let _draggingGate = null;

function gateArity(gate) {
  return GATE_ARITY[gate] ?? 2; // 預設當作 2-input
}


// shared state (simple for now)
let _assignment = {}; // slotId -> gateName

export function getAssignment() {
  return { ..._assignment };
}

export function resetAssignment() {
  _assignment = {};
}

/**
 * Initialize the palette (bottom gate bar).
 * @param {HTMLElement} gateBarEl - container of .gateCard elements
 */
export function initGatePalette(gateBarEl) {
  if (!gateBarEl) throw new Error("initGatePalette: gateBarEl not found");

  gateBarEl.querySelectorAll(".gateCard").forEach((card) => {
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      const remainingAttr = card.dataset.remaining;
      if (remainingAttr !== undefined && remainingAttr !== "") {
        const remaining = Number(remainingAttr);
        if (!Number.isNaN(remaining) && remaining <= 0) return;
      }
      const gate = (card.dataset.gate || card.textContent || "").trim().toLowerCase();
      if (!gate) return;
      _draggingGate = gate;

      e.dataTransfer.setData(MIME, gate);
      e.dataTransfer.setData("text/plain", gate); // fallback
      e.dataTransfer.effectAllowed = "copy";
    });

    card.addEventListener("dragend", () => {
        _draggingGate = null;
    });
  });

    
}

/**
 * Enable drop targets on the circuit board.
 * Must be called after every renderCircuit(), because slots are re-created.
 *
 * @param {HTMLElement} boardEl - container that includes .slotNode/.blankBox
 * @param {Object} opts
 * @param {(slotId: string, gate: string) => boolean} [opts.accept] - optional accept filter
 * @param {(assignment: Object) => void} [opts.onChange] - callback after placement/clear
 */
// opts.question: the current question JSON
// opts.outBitEl: the DOM element to update (the <div class="bit"> inside OUT box)
export function enableSlotDrops(boardEl, opts = {}) {
  if (!boardEl) throw new Error("enableSlotDrops: boardEl not found");

  const accept = typeof opts.accept === "function" ? opts.accept : () => true;
  const onChange = typeof opts.onChange === "function" ? opts.onChange : null;

  const question = opts.question || null;
    const slotMap = new Map();
    if (question?.slots) {
    for (const s of question.slots) slotMap.set(s.id, s);
    }
  function acceptByArity(slotId, gate) {
  const slot = slotMap.get(slotId);
  if (!slot) return true; // 找不到就放行（你也可以改成 false）
  return gateArity(gate) === slot.arity;
}

  const outBitEl = opts.outBitEl || null;

  const blanks = boardEl.querySelectorAll(".slotNode .blankBox");

  function updateOutput() {
    if (!question || !outBitEl) return;
    try {
      const res = evaluate(question, _assignment); // evaluate.js
      outBitEl.textContent = String(res.value);
    } catch {
      outBitEl.textContent = "?";
    }
  }

  blanks.forEach((blank) => {
    blank.addEventListener("dragover", (e) => {
  const slotId = blank.closest(".slotNode")?.dataset.nodeId;
  if (!slotId) return;

  if (_draggingGate && acceptByArity(slotId, _draggingGate) && accept(slotId, _draggingGate)) {
    e.preventDefault();              // 只在合法時才 allow drop
    e.dataTransfer.dropEffect = "copy";
    blank.classList.add("droppable");
  } else {
    blank.classList.remove("droppable");
  }
});


    blank.addEventListener("dragleave", () => {
      blank.classList.remove("droppable");
    });

    blank.addEventListener("drop", (e) => {
      e.preventDefault();
      blank.classList.remove("droppable");

      const gate = (e.dataTransfer.getData(MIME) || e.dataTransfer.getData("text/plain") || "")
        .trim()
        .toLowerCase();

      const slotId = blank.closest(".slotNode")?.dataset.nodeId;
      if (!slotId || !gate) return;
      if (!acceptByArity(slotId, gate)) return; // check arity
      if (!accept(slotId, gate)) return;

      placeGateIntoBlank(blank, gate);
      _assignment[slotId] = gate;

      if (onChange) onChange(getAssignment());
      updateOutput(); // ✅ evaluate immediately
    });

    // keep your dblclick-clear behavior
    blank.addEventListener("dblclick", () => {
      const slotId = blank.closest(".slotNode")?.dataset.nodeId;
      if (!slotId) return;

      clearBlank(blank);
      delete _assignment[slotId];

      if (onChange) onChange(getAssignment());
      updateOutput(); // ✅ update to "?" again if not full
    });
  });

  updateOutput(); // ✅ set initial output when enabling
}


/* ---------------- UI helpers ---------------- */

function placeGateIntoBlank(blank, gate) {
  blank.innerHTML = ""; // replace existing

  const pill = document.createElement("div");
  pill.className = "gatePlaced";
  pill.dataset.gate = gate;

  const img = document.createElement("img");
  img.className = "gatePlacedImg";
  img.src = `./img/${gate}.png`; // ✅ 路徑要跟你 gateBar 用同一套
  img.alt = gate;

  pill.appendChild(img);
  blank.appendChild(pill);
}


function clearBlank(blank) {
  blank.innerHTML = "";
}
