const { validateDocument } = require('./validator');

class Schema {
    #fields;
    #strict;

    constructor(definition = {}, options = {}) {
        this.#fields = {};
        this.#strict = options.strict || false;

        for (const [name, rule] of Object.entries(definition)) {
            if (typeof rule === 'string') {
                this.#fields[name] = { type: rule, required: false };
            } else if (typeof rule === 'object' && rule !== null) {
                this.#fields[name] = {
                    type: rule.type || 'any',
                    required: rule.required || false,
                    default: rule.default,
                    min: rule.min,
                    max: rule.max,
                    minLength: rule.minLength,
                    maxLength: rule.maxLength,
                    enum: rule.enum,
                    match: rule.match,
                    message: rule.message,
                };
            }
        }
    }

    validate(doc) {
        return validateDocument(doc, this.#fields, this.#strict);
    }

    applyDefaults(doc) {
        const result = { ...doc };
        for (const [name, rule] of Object.entries(this.#fields)) {
            if (result[name] === undefined && rule.default !== undefined) {
                result[name] = typeof rule.default === 'function' ? rule.default() : rule.default;
            }
        }
        return result;
    }

    pick(doc, ...fields) {
        const result = {};
        for (const f of fields) {
            if (doc[f] !== undefined) result[f] = doc[f];
        }
        return result;
    }

    omit(doc, ...fields) {
        const result = { ...doc };
        for (const f of fields) delete result[f];
        return result;
    }

    getFieldNames() {
        return Object.keys(this.#fields);
    }

    getRequiredFields() {
        return Object.entries(this.#fields)
            .filter(([, rule]) => rule.required)
            .map(([name]) => name);
    }
}

module.exports = { Schema };
