// src/render/drag.js
// Drag-and-drop for gate palette -> slot blank boxes
// - Palette is infinite supply (drag copies)
// - Drop replaces existing gate in that slot
// - Double click on a slot to clear
// - Maintains assignment map: { slotId: gateName }

const MIME = "application/x-logic-gate";

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
      const gate = (card.dataset.gate || card.textContent || "").trim().toLowerCase();
      if (!gate) return;

      e.dataTransfer.setData(MIME, gate);
      e.dataTransfer.setData("text/plain", gate); // fallback
      e.dataTransfer.effectAllowed = "copy";
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
export function enableSlotDrops(boardEl, opts = {}) {
  if (!boardEl) throw new Error("enableSlotDrops: boardEl not found");

  const accept = typeof opts.accept === "function" ? opts.accept : () => true;
  const onChange = typeof opts.onChange === "function" ? opts.onChange : null;

  const blanks = boardEl.querySelectorAll(".slotNode .blankBox");

  blanks.forEach((blank) => {
    // Allow drop
    blank.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        blank.classList.add("droppable");
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

      const slotEl = blank.closest(".slotNode");
      const slotId = slotEl?.dataset.nodeId;

      if (!slotId || !gate) return;
      if (!accept(slotId, gate)) return;

      placeGateIntoBlank(blank, gate);
      _assignment[slotId] = gate;

      if (onChange) onChange(getAssignment());
    });

    // Double click to clear
    blank.addEventListener("dblclick", () => {
      const slotId = blank.closest(".slotNode")?.dataset.nodeId;
      if (!slotId) return;

      clearBlank(blank);
      delete _assignment[slotId];

      if (onChange) onChange(getAssignment());
    });
  });
}

/* ---------------- UI helpers ---------------- */

function placeGateIntoBlank(blank, gate) {
  blank.innerHTML = ""; // replace existing

  const pill = document.createElement("div");
  pill.className = "gatePlaced";
  pill.textContent = gate.toUpperCase();
  pill.dataset.gate = gate;

  blank.appendChild(pill);
}

function clearBlank(blank) {
  blank.innerHTML = "";
}
