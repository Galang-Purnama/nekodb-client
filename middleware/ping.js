class PingManager {
    #ws;
    #interval;
    #timer;

    constructor(ws, interval = 25000) {
        this.#ws = ws;
        this.#interval = interval;
        this.#timer = null;
    }

    start() {
        if (this.#timer) return;
        this.#timer = setInterval(() => {
            if (this.#ws && this.#ws.readyState === 1) {
                try { this.#ws.ping(); } catch { }
            }
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
