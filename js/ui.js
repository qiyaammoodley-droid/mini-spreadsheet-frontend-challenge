let activeCellId = null;

// 1. GENERATE THE GRID DYNAMICALLY
function createSpreadsheet() {
    const spreadsheet = document.getElementById("spreadsheet");
    const table = document.createElement("table");

    // Create the top row (Letters A-J)
    const headerRow = document.createElement("tr");
    headerRow.appendChild(document.createElement("th")); // Blank corner

    for (let col = 0; col < CONFIG.COLUMNS; col++) {
        const th = document.createElement("th");
        const letter = String.fromCharCode(65 + col);
        th.textContent = letter;
        th.id = `col-${letter}`;
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    // Create the data rows (1-20)
    for (let row = 1; row <= CONFIG.ROWS; row++) {
        const tr = document.createElement("tr");

        const rowHeader = document.createElement("th");
        rowHeader.textContent = row;
        rowHeader.id = `row-${row}`;
        tr.appendChild(rowHeader);

        for (let col = 0; col < CONFIG.COLUMNS; col++) {
            const td = document.createElement("td");
            td.contentEditable = true;

            const cellId = String.fromCharCode(65 + col) + row;
            td.dataset.cell = cellId;

            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    spreadsheet.appendChild(table);
    setupUIEventListeners();
}

// 2. HANDLE VISUAL INTERACTIONS (CLICK & TYPE)
function setupUIEventListeners() {
    const spreadsheet = document.getElementById("spreadsheet");
    const formulaBar = document.getElementById("formula-bar");

    if (!spreadsheet || !formulaBar) return;

    // When a user clicks into a cell
    spreadsheet.addEventListener("focusin", (e) => {
        const cell = e.target;
        if (cell.tagName === "TD" && cell.dataset.cell) {
            activeCellId = cell.dataset.cell;
            formulaBar.placeholder = `Editing Cell ${activeCellId}`;

            // Show formula if it exists in state, otherwise show plain text
            const rawValue = (window.sheetState && window.sheetState.rawCells[activeCellId]) ?? cell.textContent;
            cell.textContent = rawValue;
            formulaBar.value = rawValue;

            highlightHeaders(activeCellId, true);
        }
    });

    // When a user clicks away from a cell
    spreadsheet.addEventListener("focusout", (e) => {
        const cell = e.target;
        if (cell.tagName === "TD" && cell.dataset.cell) {
            highlightHeaders(cell.dataset.cell, false);

            // Save the raw text into the global shared state
            if (window.engine) {
                window.engine.updateCell(
                    cell.dataset.cell,
                    cell.textContent
                );
            }
        }
    });

    // When typing in the formula bar, mirror it to the active cell live
    formulaBar.addEventListener("input", () => {
        if (activeCellId) {
            const activeCell = document.querySelector(`[data-cell="${activeCellId}"]`);
            if (activeCell) activeCell.textContent = formulaBar.value;
        }
    });
}

// 3. HIGHLIGHT THE ACTIVE ROW/COLUMN HEADERS
function highlightHeaders(cellId, shouldHighlight) {
    const colLetter = cellId.replace(/[0-9]/g, '');
    const rowNumber = cellId.replace(/[A-Z]/g, '');

    const colHeader = document.getElementById(`col-${colLetter}`);
    const rowHeader = document.getElementById(`row-${rowNumber}`);

    if (shouldHighlight) {
        colHeader?.classList.add("header-active");
        rowHeader?.classList.add("header-active");
    } else {
        colHeader?.classList.remove("header-active");
        rowHeader?.classList.remove("header-active");
    }
}

document.addEventListener("DOMContentLoaded", createSpreadsheet);