const { NekoError } = require('./base');

class ConnectionError extends NekoError {
    constructor(message, host) {
        super(message || 'Connection failed', 'CONNECTION_ERROR');
        this.name = 'ConnectionError';
        this.host = host || null;
    }
}

class TimeoutError extends NekoError {
    constructor(message, operation, durationMs) {
        super(message || 'Operation timed out', 'TIMEOUT');
        this.name = 'TimeoutError';
        this.operation = operation || null;
        this.durationMs = durationMs || 0;
    }
}

module.exports = {
    ConnectionError,
    TimeoutError,
};
