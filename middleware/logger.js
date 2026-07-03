class Logger {
    #enabled;
    #prefix;
    #level;
    #levels;
    #customLogger;

    constructor(prefix = '[NekoDB]', levelOrLogger = 'info') {
        this.#enabled = true;
        this.#prefix = prefix;
        this.#levels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
        
        if (levelOrLogger && typeof levelOrLogger === 'object') {
            this.#customLogger = levelOrLogger;
            this.#level = 0;
        } else {
            this.#level = this.#levels[levelOrLogger] || 1;
            this.#customLogger = null;
        }
    }

    debug(...args) {
        if (!this.#enabled) return;
        if (this.#customLogger) {
            if (typeof this.#customLogger.debug === 'function') this.#customLogger.debug(...args);
        } else if (this.#level <= 0) {
            console.log(this.#prefix, '[DEBUG]', ...args);
        }
    }

    info(...args) {
        if (!this.#enabled) return;
        if (this.#customLogger) {
            if (typeof this.#customLogger.info === 'function') this.#customLogger.info(...args);
        } else if (this.#level <= 1) {
            console.log(this.#prefix, '[INFO]', ...args);
        }
    }

    warn(...args) {
        if (!this.#enabled) return;
        if (this.#customLogger) {
            if (typeof this.#customLogger.warn === 'function') this.#customLogger.warn(...args);
        } else if (this.#level <= 2) {
            console.warn(this.#prefix, '[WARN]', ...args);
        }
    }

    error(...args) {
        if (!this.#enabled) return;
        if (this.#customLogger) {
            if (typeof this.#customLogger.error === 'function') this.#customLogger.error(...args);
        } else if (this.#level <= 3) {
            console.error(this.#prefix, '[ERROR]', ...args);
        }
    }

    enable() { this.#enabled = true; }
    disable() { this.#enabled = false; }
    setLevel(level) {
        if (typeof level === 'string') {
            this.#level = this.#levels[level] || 1;
            this.#customLogger = null;
        }
    }
}

module.exports = { Logger };
