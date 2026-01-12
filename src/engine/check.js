import { GATES } from "./gates.js";

export function evaluate(question, assignment) {
  const { inputs, slots, output } = question;

  const slotMap = {};
  for (const s of slots) slotMap[s.id] = s;

  const cache = {};   // slotId -> 0/1
  const trace = {};   // for debug

  function solve(nodeId) {
    // input?
    if (inputs.hasOwnProperty(nodeId)) {
      return inputs[nodeId];
    }

    // slot?
    const slot = slotMap[nodeId];
    if (!slot) return "?";

    // gate not placed yet
    const gate = assignment[nodeId];
    if (!gate) return "?";

    // resolve inputs
    const values = slot.in.map(solve);
    if (values.includes("?")) return "?";

    const fn = GATES[gate];
    if (!fn) throw new Error("Unknown gate " + gate);

    const out = fn(...values);
    cache[nodeId] = out;
    trace[nodeId] = out;
    return out;
  }

  const result = solve(output);
  return { value: result, trace };
}
