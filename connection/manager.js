class ConnectionManager {
    #connections;
    #activeId;
    #healthChecks;
    #maxConnections;

    constructor(maxConnections = 5) {
        this.#connections = new Map();
        this.#activeId = null;
        this.#healthChecks = new Map();
        this.#maxConnections = maxConnections;
    }

    add(id, nekoDBInstance) {
        if (this.#connections.size >= this.#maxConnections) {
            throw new Error(`Max connections (${this.#maxConnections}) reached`);
        }
        this.#connections.set(id, {
            db: nekoDBInstance,
            addedAt: new Date(),
            lastUsed: new Date(),
        });
        if (!this.#activeId) this.#activeId = id;
        return this;
    }

    remove(id) {
        const entry = this.#connections.get(id);
        if (entry) {
            try { entry.db.close(); } catch { }
            this.#connections.delete(id);
            if (this.#activeId === id) {
                const keys = [...this.#connections.keys()];
                this.#activeId = keys.length > 0 ? keys[0] : null;
            }
        }
        return this;
    }

    get(id) {
        const entry = this.#connections.get(id);
        if (entry) {
            entry.lastUsed = new Date();
            return entry.db;
        }
        return null;
    }

    active() {
        if (!this.#activeId) return null;
        return this.get(this.#activeId);
    }

    setActive(id) {
        if (!this.#connections.has(id)) {
            throw new Error(`Connection "${id}" not found`);
        }
        this.#activeId = id;
        return this;
    }

    get activeId() { return this.#activeId; }

    has(id) {
        return this.#connections.has(id);
    }

    list() {
        const result = [];
        for (const [id, entry] of this.#connections) {
            result.push({
                id,
                connected: entry.db.connected,
                addedAt: entry.addedAt,
                lastUsed: entry.lastUsed,
                isActive: id === this.#activeId,
            });
        }
        return result;
    }

    get size() {
        return this.#connections.size;
    }

    getHealthy() {
        const healthy = [];
        for (const [id, entry] of this.#connections) {
            if (entry.db.connected) healthy.push(id);
        }
        return healthy;
    }

    getUnhealthy() {
        const unhealthy = [];
        for (const [id, entry] of this.#connections) {
            if (!entry.db.connected) unhealthy.push(id);
        }
        return unhealthy;
    }

    switchToHealthy() {
        const healthy = this.getHealthy();
        if (healthy.length === 0) return false;
        if (healthy.includes(this.#activeId)) return true;
        this.#activeId = healthy[0];
        return true;
    }

    async closeAll() {
        for (const [id, entry] of this.#connections) {
            try { entry.db.close(); } catch { }
        }
        this.#connections.clear();
        this.#activeId = null;
    }

    getStats() {
        let connected = 0;
        let disconnected = 0;
        for (const [, entry] of this.#connections) {
            if (entry.db.connected) connected++;
            else disconnected++;
        }
        return {
            total: this.#connections.size,
            connected,
            disconnected,
            activeId: this.#activeId,
            maxConnections: this.#maxConnections,
        };
    }
}

module.exports = { ConnectionManager };
