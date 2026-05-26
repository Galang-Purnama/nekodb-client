const { NekoError } = require('./base');
const { ConnectionError, TimeoutError } = require('./network');
const { AuthError, NotFoundError, ValidationError, BulkOperationError, CollectionError } = require('./database');
const { classify } = require('./classifier');

module.exports = {
    NekoError,
    ConnectionError,
    TimeoutError,
    AuthError,
    NotFoundError,
    ValidationError,
    BulkOperationError,
    CollectionError,
    classify,
};
