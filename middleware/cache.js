class ResponseCache {
    #cache;
    #ttl;
    #maxSize;

    constructor(ttl = 10000, maxSize = 200) {
        this.#cache = new Map();
        this.#ttl = ttl;
        this.#maxSize = maxSize;
    }

    set(key, value) {
        if (this.#cache.size >= this.#maxSize) {
            const oldest = this.#cache.keys().next().value;
            this.#cache.delete(oldest);
        }
        this.#cache.set(key, { value: this.#clone(value), expires: Date.now() + this.#ttl });
    }

    get(key) {
        const entry = this.#cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.#cache.delete(key);
            return null;
        }
        return this.#clone(entry.value);
    }

    has(key) {
        return this.get(key) !== null;
    }

    invalidate(key) {
        this.#cache.delete(key);
    }

    invalidatePrefix(prefix) {
        for (const key of this.#cache.keys()) {
            if (key.startsWith(prefix)) {
                this.#cache.delete(key);
            }
        }
    }

    clear() {
        this.#cache.clear();
    }

    #clone(val) {
        if (val === null || typeof val !== 'object') return val;
        try {
            return JSON.parse(JSON.stringify(val));
        } catch {
            return val;
        }
    }

    get size() {
        return this.#cache.size;
    }
}

module.exports = { ResponseCache };
