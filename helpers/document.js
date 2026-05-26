const crypto = require('crypto');

function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

function getNestedValue(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object') return acc[part];
        return undefined;
    }, obj);
}

function setNestedValue(obj, path, value) {
    if (!path) return obj;
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === undefined || typeof current[part] !== 'object' || current[part] === null) {
            current[part] = {};
        }
        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    return obj;
}

function deepMerge(target, source) {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = deepMerge(result[key] || {}, value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

module.exports = {
    generateId,
    getNestedValue,
    setNestedValue,
    deepMerge,
};
