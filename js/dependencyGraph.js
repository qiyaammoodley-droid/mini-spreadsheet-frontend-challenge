class DependencyGraph {
    constructor() {
        // Cell -> cells it depends on
        this.dependencies = new Map();

        // Cell -> cells depending on it
        this.dependents = new Map();
    }

    // Links a cell to its new dependencies and updates the inverse map
    setDependencies(cellId, dependencies) {

        this.removeDependencies(cellId);

        this.dependencies.set(cellId, new Set(dependencies));

        dependencies.forEach(dep => {

            if (!this.dependents.has(dep)) {
                this.dependents.set(dep, new Set());
            }

            this.dependents.get(dep).add(cellId);

        });
    }

    // Cleans up tracking records when a cell is updated or overwritten
    removeDependencies(cellId) {

        const oldDependencies = this.dependencies.get(cellId);

        if (!oldDependencies) return;

        oldDependencies.forEach(dep => {

            const dependents = this.dependents.get(dep);

            if (dependents) {

                dependents.delete(cellId);

                if (dependents.size === 0) {
                    this.dependents.delete(dep);
                }
            }

        });

        this.dependencies.delete(cellId);
    }

    getDependents(cellId) {

        return this.dependents.get(cellId) || new Set();

    }

    getDependencies(cellId) {

        return this.dependencies.get(cellId) || new Set();

    }
}

window.DependencyGraph = DependencyGraph;