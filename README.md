# Logic Gate Game

A small front-end logic gate drag-and-drop game built with plain HTML/CSS/JS. Levels are described in JSON, and the circuit UI is rendered with SVG + DIV nodes.

## Features
- Loads levels from `src/question/*.json`
- Renders inputs, slot nodes, and output
- Drag gates from the Gate Bar into slots
- Switching levels re-renders the circuit

## Getting Started
This project uses ES modules and `fetch`, so you must run a local server.

```bash
# from the project root
python -m http.server
```

Then open:
`http://localhost:8000/`

## Project Structure
```
index.html
src/
  main.js
  render/
    renderCircuit.js
    drag.js
  question/
    test.json
    test2.json
    test3.json
```

## Level Format (JSON)
```json
{
  "id": "test01",
  "inputs": { "A": 1, "B": 1, "C": 0 },
  "slots": [
    { "id": "s1", "arity": 2, "in": ["A", "B"], "accept": ["OR"] },
    { "id": "s2", "arity": 2, "in": ["s1", "C"], "accept": ["AND"] }
  ],
  "output": "s2",
  "gateCounts": { "or": 1, "and": 2, "not": 1, "xor": 1, "buffer": 1 },
  "solution": { "s1": "OR", "s2": "AND" },
  "expectedOutput": 1
}
```

Field notes:
- `inputs`: input pins and their initial values (0/1)
- `slots`: placeable gate nodes, `in` lists source nodes
- `output`: final output node id
- `gateCounts`: gate name -> remaining count to show in the gate bar (optional)
- `solution`: reference solution (optional)
- `expectedOutput`: expected output bit (optional)

## FAQ
- Opening `index.html` directly can fail to load modules or JSON. Use a local server instead.
