export const GATES = {
  buffer: (a) => a,
  not:    (a) => a ^ 1,

  and:  (a,b) => a & b,
  or:   (a,b) => a | b,
  xor:  (a,b) => a ^ b,

  nand: (a,b) => (a & b) ^ 1,
  nor:  (a,b) => (a | b) ^ 1,
  xnor: (a,b) => (a ^ b) ^ 1,
};

