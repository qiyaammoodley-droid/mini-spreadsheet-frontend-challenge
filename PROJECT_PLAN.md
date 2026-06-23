# Mini Spreadsheet Architecture

## UI Layer

Responsible for:

- Rendering spreadsheet grid
- Cell selection
- Formula bar updates
- User interaction

Files:

- ui.js
- styles.css

---

## Parser Layer

Responsible for:

- Formula tokenization
- Formula parsing
- Reading references
- SUM and AVG support

Files:

- parser.js

---

## Engine Layer

Responsible for:

- Cell calculations
- Data storage
- Formula evaluation

Files:

- engine.js

---

## Dependency Layer

Responsible for:

- Tracking cell relationships
- Recalculating dependent cells

Files:

- dependencyGraph.js

---

## Error Layer

Responsible for:

- Circular reference detection
- Division by zero
- Invalid formulas
- Value errors

Files:

- errors.js