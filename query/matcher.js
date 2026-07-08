const { getNestedValue } = require('../helpers/document');

/**
 * Checks if a document matches the query filter criteria.
 * Mirrors Go's server-side matchesQuery implementation.
 * @param {object} doc 
 * @param {object} query 
 * @returns {boolean}
 */
function matchesQuery(doc, query) {
    if (!query || typeof query !== 'object') return true;
    
    for (const [key, queryValue] of Object.entries(query)) {
        const docValue = getNestedValue(doc, key);
        if (docValue === undefined) {
            return false;
        }
        
        if (queryValue && typeof queryValue === 'object' && !Array.isArray(queryValue)) {
            if (!matchesOperators(docValue, queryValue)) {
                return false;
            }
        } else {
            if (docValue !== queryValue) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Evaluates operator-based conditions.
 * @param {*} docValue 
 * @param {object} operators 
 * @returns {boolean}
 */
function matchesOperators(docValue, operators) {
    for (const [op, opValue] of Object.entries(operators)) {
        switch (op) {
            case '$eq':
                if (docValue !== opValue) return false;
                break;
            case '$ne':
                if (docValue === opValue) return false;
                break;
            case '$gt':
                if (!compareValues(docValue, opValue, '>')) return false;
                break;
            case '$gte':
                if (!compareValues(docValue, opValue, '>=')) return false;
                break;
            case '$lt':
                if (!compareValues(docValue, opValue, '<')) return false;
                break;
            case '$lte':
                if (!compareValues(docValue, opValue, '<=')) return false;
                break;
            case '$in':
                if (!valueInArray(docValue, opValue)) return false;
                break;
            case '$nin':
                if (valueInArray(docValue, opValue)) return false;
                break;
            case '$regex':
                if (typeof docValue !== 'string' || typeof opValue !== 'string') return false;
                try {
                    const regex = new RegExp(opValue);
                    if (!regex.test(docValue)) return false;
                } catch {
                    return false;
                }
                break;
        }
    }
    return true;
}

/**
 * Performs numeric comparisons.
 */
function compareValues(docValue, opValue, operator) {
    if (typeof docValue !== 'number' || typeof opValue !== 'number') {
        return false;
    }
    switch (operator) {
        case '>':
            return docValue > opValue;
        case '>=':
            return docValue >= opValue;
        case '<':
            return docValue < opValue;
        case '<=':
            return docValue <= opValue;
        default:
            return false;
    }
}

/**
 * Checks if a value is contained within an array.
 */
function valueInArray(docValue, arrayValue) {
    if (!Array.isArray(arrayValue)) {
        return false;
    }
    return arrayValue.includes(docValue);
}

/**
 * Sorts documents in memory based on sort field definitions.
 * @param {Array} docs 
 * @param {Array} sortFields 
 * @returns {Array} Sorted array clone
 */
function sortDocuments(docs, sortFields) {
    if (!Array.isArray(sortFields) || sortFields.length === 0) {
        return docs;
    }
    return [...docs].sort((a, b) => {
        for (const { field, order } of sortFields) {
            const valA = getNestedValue(a, field);
            const valB = getNestedValue(b, field);
            
            if (valA === valB) continue;
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            
            const isAsc = String(order).toLowerCase() !== 'desc';
            if (valA < valB) return isAsc ? -1 : 1;
            if (valA > valB) return isAsc ? 1 : -1;
        }
        return 0;
    });
}

module.exports = {
    matchesQuery,
    sortDocuments,
};
