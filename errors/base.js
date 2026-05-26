class NekoError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'NekoError';
        this.code = code || 'UNKNOWN';
        this.timestamp = new Date();
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            timestamp: this.timestamp,
        };
    }
}

module.exports = { NekoError };
