// src/main.js
import { renderCircuit } from "./render/renderCircuit.js";

async function loadQuestion(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

async function main() {
  const board = document.getElementById("board");
  const info = document.getElementById("info");

  const question = await loadQuestion("./src/question/test.json");
  info.textContent = `Loaded: ${question.id ?? "test"} | slots: ${(question.slots ?? []).length}`;

  renderCircuit(question, board, {
    columns: 3
  });
}

main().catch(err => {
  console.error(err);
  const info = document.getElementById("info");
  info.textContent = "Error: " + err.message;
});
