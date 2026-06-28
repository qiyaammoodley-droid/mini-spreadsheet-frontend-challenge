class SpreadsheetEngine {
    constructor() {
        // Stores every cell in the spreadsheet
        this.cells = {};

        // Stores exactly what the user typed
        this.rawCells = {};

        // Dependency manager
        this.graph = new DependencyGraph();

        // Let the UI access the raw contents
        window.sheetState = this;
    }

    /**
     * Sweeps through dependents, checks for cycles, and updates downstream cells in order.
     */
    recalculate(changedCellId) {
        try {
            const updateOrder = this.getRecalculationOrder(changedCellId);
            for (const cellId of updateOrder) {
                if (this.rawCells[cellId] && this.rawCells[cellId].startsWith("=")) {
                    this.evaluateFormula(cellId);
                }
            }
        } catch (error) {
            // If a circular dependency error was thrown during graph walk
            if (error instanceof CellError && error.code === CONFIG.ERRORS.CIRCULAR) {
                this.markChainAsCircular(changedCellId);
            } else {
                console.error("Recalculation error:", error);
            }
        }
    }

    /**
     * DFS-based Topological Sort that detects cycles simultaneously
     */
    getRecalculationOrder(startCellId) {
        const order = [];
        const visited = new Set();
        const visiting = new Set(); // Tracks the current path to catch loops

        const visit = (cellId) => {
            if (visiting.has(cellId)) {
                throw new CellError(CONFIG.ERRORS.CIRCULAR);
            }
            if (!visited.has(cellId)) {
                visiting.add(cellId);

                // Fetch every cell that directly depends on this one
                const dependents = this.graph.getDependents(cellId);
                for (const dep of dependents) {
                    visit(dep);
                }

                visiting.delete(cellId);
                visited.add(cellId);
                // Push to the front of the list so independent variables come first
                order.unshift(cellId);
            }
        };

        // We want to find the order for dependents downstream of the changed cell
        const directDeps = this.graph.getDependents(startCellId);
        for (const dep of directDeps) {
            visit(dep);
        }

        return order;
    }

    /**
     * Recursively marks all downstream dependent cells with a #CIRCULAR! error
     */
    markChainAsCircular(cellId) {
        const visited = new Set();

        const mark = (id) => {
            if (visited.has(id)) return;
            visited.add(id);

            this.saveCell(id, null, this.cells[id]?.formula, CONFIG.ERRORS.CIRCULAR);
            this.renderCell(id);

            const dependents = this.graph.getDependents(id);
            for (const dep of dependents) {
                mark(dep);
            }
        };

        mark(cellId);
    }

    getCell(cellId) {
        if (!this.cells[cellId]) {
            return {
                value: "",
                formula: null,
                error: null
            };
        }
        return this.cells[cellId];
    }

    getCellValue(cellId) {
        return this.getCell(cellId);
    }

    saveCell(cellId, value, formula = null, error = null) {
        this.cells[cellId] = {
            value,
            formula,
            error
        };
    }

    updateCell(cellId, rawValue) {
        console.log("updateCell called:", cellId, rawValue);
        this.rawCells[cellId] = rawValue;

        // Process Formulas
        if (rawValue.startsWith("=")) {
            this.evaluateFormula(cellId);
            this.recalculate(cellId);
            return;
        }

        //FIX: Clear old dependencies if switching to a non-formula
        this.graph.removeDependencies(cellId);

        // Process Numbers
        if (rawValue.trim() !== "" && !isNaN(rawValue)) {
            this.saveCell(cellId, Number(rawValue));
            this.renderCell(cellId);
            this.recalculate(cellId);
            return;
        }

        // Plain text
        this.saveCell(cellId, rawValue);
        this.renderCell(cellId);
        this.recalculate(cellId);
    }

    // Runs the text parser and updates the dependency mappings
    evaluateFormula(cellId) {
        const formula = this.rawCells[cellId].substring(1);
        const result = FormulaParser.evaluateFormula(
            formula,
            (reference) => this.getCellValue(reference)
        );

        this.graph.setDependencies(cellId, result.deps);
        this.saveCell(cellId, result.value, "=" + formula, result.error);
        this.renderCell(cellId);
    }

    // Pushes the calculated result or error token directly to the DOM
    renderCell(cellId) {
        const td = document.querySelector(`[data-cell="${cellId}"]`);
        if (!td) return;

        const cell = this.getCell(cellId);
        td.textContent = cell.error ? cell.error : cell.value;
    }
}

window.engine = new SpreadsheetEngine();