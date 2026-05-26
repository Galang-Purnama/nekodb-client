const { checkType } = require('./types');

function validateDocument(doc, fields, strict) {
    const errors = [];

    for (const [name, rule] of Object.entries(fields)) {
        const value = doc[name];

        if (value === undefined || value === null) {
            if (rule.required) {
                errors.push({ field: name, rule: 'required', message: rule.message || `"${name}" is required` });
            }
            continue;
        }

        if (rule.type !== 'any') {
            if (!checkType(value, rule.type)) {
                errors.push({ field: name, rule: 'type', message: `"${name}" expected ${rule.type}, got ${Array.isArray(value) ? 'array' : typeof value}` });
                continue;
            }
        }

        if (rule.type === 'number') {
            if (rule.min !== undefined && value < rule.min) {
                errors.push({ field: name, rule: 'min', message: `"${name}" must be >= ${rule.min}` });
            }
            if (rule.max !== undefined && value > rule.max) {
                errors.push({ field: name, rule: 'max', message: `"${name}" must be <= ${rule.max}` });
            }
        }

        if (rule.type === 'string') {
            if (rule.minLength !== undefined && value.length < rule.minLength) {
                errors.push({ field: name, rule: 'minLength', message: `"${name}" min length is ${rule.minLength}` });
            }
            if (rule.maxLength !== undefined && value.length > rule.maxLength) {
                errors.push({ field: name, rule: 'maxLength', message: `"${name}" max length is ${rule.maxLength}` });
            }
            if (rule.match && !rule.match.test(value)) {
                errors.push({ field: name, rule: 'match', message: `"${name}" format is invalid` });
            }
        }

        if (rule.enum && !rule.enum.includes(value)) {
            errors.push({ field: name, rule: 'enum', message: `"${name}" must be one of: ${rule.enum.join(', ')}` });
        }
    }

    if (strict) {
        for (const key of Object.keys(doc)) {
            if (!(key in fields)) {
                errors.push({ field: key, rule: 'strict', message: `Unknown field "${key}"` });
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

module.exports = { validateDocument };
