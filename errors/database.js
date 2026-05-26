const { NekoError } = require('./base');

class AuthError extends NekoError {
    constructor(message) {
        super(message || 'Authentication failed', 'AUTH_ERROR');
        this.name = 'AuthError';
    }
}

class NotFoundError extends NekoError {
    constructor(collection, documentId) {
        super(`Document not found: ${collection}/${documentId}`, 'NOT_FOUND');
        this.name = 'NotFoundError';
        this.collection = collection;
        this.documentId = documentId;
    }
}

class ValidationError extends NekoError {
    #errors;

    constructor(message, errors) {
        super(message || 'Validation failed', 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.#errors = errors || [];
    }

    get errors() { return [...this.#errors]; }

    toJSON() {
        return { ...super.toJSON(), errors: this.#errors };
    }
}

class BulkOperationError extends NekoError {
    #results;

    constructor(message, results) {
        super(message || 'Bulk operation partially failed', 'BULK_ERROR');
        this.name = 'BulkOperationError';
        this.#results = results || [];
    }

    get results() { return [...this.#results]; }
    get successCount() { return this.#results.filter(r => r.success).length; }
    get failCount() { return this.#results.filter(r => !r.success).length; }
}

class CollectionError extends NekoError {
    constructor(message, collection) {
        super(message || 'Collection error', 'COLLECTION_ERROR');
        this.name = 'CollectionError';
        this.collection = collection;
    }
}

module.exports = {
    AuthError,
    NotFoundError,
    ValidationError,
    BulkOperationError,
    CollectionError,
};
