function createSpreadsheet() {
    const spreadsheet = document.getElementById("spreadsheet");

    const table = document.createElement("table");

    // Header row
    const headerRow = document.createElement("tr");

    const cornerCell = document.createElement("th");
    headerRow.appendChild(cornerCell);

    for (let col = 0; col < CONFIG.COLUMNS; col++) {
        const th = document.createElement("th");
        th.textContent = String.fromCharCode(65 + col);
        headerRow.appendChild(th);
    }

    table.appendChild(headerRow);

    // Rows
    for (let row = 1; row <= CONFIG.ROWS; row++) {
        const tr = document.createElement("tr");

        const rowHeader = document.createElement("th");
        rowHeader.textContent = row;
        tr.appendChild(rowHeader);

        for (let col = 0; col < CONFIG.COLUMNS; col++) {
            const td = document.createElement("td");

            td.contentEditable = true;

            const cellId =
                String.fromCharCode(65 + col) + row;

            td.dataset.cell = cellId;

            tr.appendChild(td);
        }

        table.appendChild(tr);
    }

    spreadsheet.appendChild(table);
}

createSpreadsheet();