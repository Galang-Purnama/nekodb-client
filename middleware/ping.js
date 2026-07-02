class PingManager {
    #pingFn;
    #interval;
    #timer;

    constructor(pingFn, interval = 25000) {
        this.#pingFn = pingFn;
        this.#interval = interval;
        this.#timer = null;
    }

    start() {
        if (this.#timer) return;
        this.#timer = setInterval(() => {
            try { this.#pingFn(); } catch { }
        }, this.#interval);
    }

    stop() {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = null;
        }
    }
}

module.exports = { PingManager };
