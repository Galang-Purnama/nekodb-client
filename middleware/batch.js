class BatchCollector {
    #queue;
    #maxSize;
    #flushInterval;
    #timer;
    #onFlush;

    constructor(onFlush, maxSize = 50, flushInterval = 3000) {
        this.#queue = [];
        this.#maxSize = maxSize;
        this.#flushInterval = flushInterval;
        this.#timer = null;
        this.#onFlush = onFlush;
    }

    add(operation) {
        this.#queue.push(operation);
        if (this.#queue.length >= this.#maxSize) {
            this.flush();
        } else if (!this.#timer) {
            this.#timer = setTimeout(() => this.flush(), this.#flushInterval);
        }
    }

    async flush() {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        if (this.#queue.length === 0) return;
        const ops = [...this.#queue];
        this.#queue = [];
        if (this.#onFlush) await this.#onFlush(ops);
    }

    get pending() {
        return this.#queue.length;
    }

    destroy() {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        this.#queue = [];
    }
}

module.exports = { BatchCollector };
