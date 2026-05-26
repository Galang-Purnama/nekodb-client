class Logger {
    #enabled;
    #prefix;
    #level;
    #levels;

    constructor(prefix = '[NekoDB]', level = 'info') {
        this.#enabled = true;
        this.#prefix = prefix;
        this.#levels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
        this.#level = this.#levels[level] || 1;
    }

    debug(...args) {
        if (this.#enabled && this.#level <= 0) console.log(this.#prefix, '[DEBUG]', ...args);
    }

    info(...args) {
        if (this.#enabled && this.#level <= 1) console.log(this.#prefix, '[INFO]', ...args);
    }

    warn(...args) {
        if (this.#enabled && this.#level <= 2) console.warn(this.#prefix, '[WARN]', ...args);
    }

    error(...args) {
        if (this.#enabled && this.#level <= 3) console.error(this.#prefix, '[ERROR]', ...args);
    }

    enable() { this.#enabled = true; }
    disable() { this.#enabled = false; }
    setLevel(level) { this.#level = this.#levels[level] || 1; }
}

module.exports = { Logger };
