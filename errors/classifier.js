const { NekoError } = require('./base');
const { AuthError, NotFoundError } = require('./database');

function classify(raw) {
    if (typeof raw === 'string') {
        const msg = raw.trim();
        if (msg === 'invalid-credentials') return new AuthError();
        if (msg === 'not-found') return new NotFoundError();
        if (msg.startsWith('blocked:')) return new NekoError(msg, 'BLOCKED');
        if (msg === 'invalid-json') return new NekoError('Invalid JSON payload', 'INVALID_PAYLOAD');
    }
    return null;
}

module.exports = { classify };
