const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Types = {
    STRING: 'string',
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    OBJECT: 'object',
    ARRAY: 'array',
    ANY: 'any',
    EMAIL: 'email',
    UUID: 'uuid',
};

function isValidType(type) {
    return Object.values(Types).includes(type);
}

function checkType(value, type) {
    if (type === Types.ANY) return true;
    if (type === Types.ARRAY) return Array.isArray(value);
    if (type === Types.EMAIL) return typeof value === 'string' && EMAIL_REGEX.test(value);
    if (type === Types.UUID) return typeof value === 'string' && UUID_REGEX.test(value);
    return typeof value === type;
}

module.exports = {
    Types,
    isValidType,
    checkType,
};
