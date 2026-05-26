class ReconnectManager {
    #delay;
    #maxDelay;
    #timer;
    #enabled;

    constructor(delay = 1500, maxDelay = 30000) {
        this.#delay = delay;
        this.#maxDelay = maxDelay;
        this.#timer = null;
        this.#enabled = true;
    }

    schedule(fn) {
        if (!this.#enabled) return;
        const wait = Math.min(this.#delay, this.#maxDelay);
        this.#timer = setTimeout(() => {
            fn();
            this.#delay = Math.min(this.#delay * 2, this.#maxDelay);
        }, wait);
    }

    reset() {
        this.#delay = 1500;
    }

    disable() {
        this.#enabled = false;
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
    }
}

module.exports = { ReconnectManager };
