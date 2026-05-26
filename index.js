const WebSocket = require('ws');
const { AuthManager } = require('./auth');
const { BufferManager, PingManager, ReconnectManager, ResponseCache, BatchCollector, Logger } = require('./middleware');
const { QueryBuilder } = require('./query');
const { Schema } = require('./schema');
const { EventBus } = require('./events');
const { CollectionHelper } = require('./helpers');
const { ConnectionManager } = require('./connection');
const errors = require('./errors');

class NekoDB {
    #host;
    #auth;
    #ws;
    #buffer;
    #ping;
    #reconnect;
    #cache;
    #batch;
    #log;
    #connectedPromise;
    #resolveConnected;
    #rejectConnected;
    #shouldReconnect;
    #connected;
    #events;

    constructor({ host, username, password, key, cache, logging }) {
        this.#host = host;
        this.#auth = new AuthManager(username, password, key);
        this.#ws = null;
        this.#buffer = new BufferManager();
        this.#reconnect = new ReconnectManager();
        this.#cache = new ResponseCache(cache?.ttl, cache?.maxSize);
        this.#log = new Logger('[NekoDB]', logging || 'none');
        this.#batch = new BatchCollector((ops) => this.bulkExecute(ops));
        this.#connectedPromise = null;
        this.#resolveConnected = null;
        this.#rejectConnected = null;
        this.#shouldReconnect = true;
        this.#connected = false;
        this.#events = {};

        this.#init();

        process.once('SIGINT', () => { this.close(); process.exit(); });
        process.once('SIGTERM', () => { this.close(); process.exit(); });
    }

    #init() {
        try {
            this.#ws = new WebSocket(`ws://${this.#host}`);
        } catch (err) {
            this.#log.error('Connection failed:', err.message);
            if (this.#rejectConnected) this.#rejectConnected(err);
            return;
        }

        this.#connectedPromise = new Promise((resolve, reject) => {
            this.#resolveConnected = resolve;
            this.#rejectConnected = reject;
        });

        this.#ws.on('open', () => {
            this.#connected = true;
            this.#reconnect.reset();

            this.#ping = new PingManager(this.#ws);
            this.#ping.start();

            this.#log.info('Connected to', this.#host);
            this.#resolveConnected(true);
            this.#emit('connected');
        });

        this.#ws.on('message', (msg) => {
            this.#buffer.append(msg);
        });

        this.#ws.on('error', (err) => {
            this.#log.error('WebSocket error:', err.message);
            this.#emit('error', err);
            if (!this.#connected && this.#rejectConnected) {
                this.#rejectConnected(err);
            }
        });

        this.#ws.on('close', () => {
            this.#connected = false;
            if (this.#ping) this.#ping.stop();
            this.#ping = null;
            this.#ws = null;
            this.#log.warn('Disconnected');
            this.#emit('disconnected');

            if (this.#shouldReconnect) {
                this.#reconnect.schedule(() => {
                    this.#log.info('Reconnecting...');
                    this.#init();
                });
            }
        });
    }

    async #ensureConnected() {
        if (this.#connected && this.#ws?.readyState === WebSocket.OPEN) return;
        await this.#connectedPromise;
    }

    async #send(payload) {
        await this.#ensureConnected();

        this.#buffer.clear();
        this.#ws.send(Buffer.from(JSON.stringify(payload)));

        return new Promise((resolve, reject) => {
            const start = Date.now();
            const poll = () => {
                if (Date.now() - start > 30000) {
                    reject(new Error('Request timeout'));
                    return;
                }
                if (!this.#buffer.hasComplete()) {
                    return setTimeout(poll, 5);
                }
                const data = this.#buffer.extract();
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            };
            poll();
        });
    }

    #request(action, collection, document, documentId, query) {
        const payload = { auth: this.#auth.getCredentials(), action };
        if (collection) payload.collection = collection;
        if (document) payload.document = document;
        if (documentId) payload.document_id = documentId;
        if (query) payload.query = query;
        return this.#send(payload);
    }

    on(event, handler) {
        if (!this.#events[event]) this.#events[event] = [];
        this.#events[event].push(handler);
        return this;
    }

    #emit(event, data) {
        const handlers = this.#events[event];
        if (handlers) handlers.forEach(h => { try { h(data); } catch { } });
    }

    get connected() { return this.#connected; }
    get ready() { return this.#connectedPromise; }

    insert(collection, data) {
        this.#cache.invalidatePrefix(`list:${collection}`);
        this.#cache.invalidatePrefix(`count:${collection}`);
        this.#log.debug('insert', collection);
        return this.#request('insert', collection, data);
    }

    get(collection, id) {
        const cacheKey = `get:${collection}:${id}`;
        const cached = this.#cache.get(cacheKey);
        if (cached) {
            this.#log.debug('cache hit', cacheKey);
            return Promise.resolve(cached);
        }
        return this.#request('get', collection, null, id).then(result => {
            this.#cache.set(cacheKey, result);
            return result;
        });
    }

    list(collection) {
        const cacheKey = `list:${collection}`;
        const cached = this.#cache.get(cacheKey);
        if (cached) return Promise.resolve(cached);
        return this.#request('list', collection).then(result => {
            this.#cache.set(cacheKey, result);
            return result;
        });
    }

    search(collection, query) {
        return this.#request('search', collection, null, null, query);
    }

    update(collection, id, data) {
        this.#cache.invalidate(`get:${collection}:${id}`);
        this.#cache.invalidatePrefix(`list:${collection}`);
        this.#log.debug('update', collection, id);
        return this.#request('update', collection, data, id);
    }

    delete(collection, id) {
        this.#cache.invalidate(`get:${collection}:${id}`);
        this.#cache.invalidatePrefix(`list:${collection}`);
        this.#cache.invalidatePrefix(`count:${collection}`);
        this.#log.debug('delete', collection, id);
        return this.#request('delete', collection, null, id);
    }

    count(collection) {
        const cacheKey = `count:${collection}`;
        const cached = this.#cache.get(cacheKey);
        if (cached) return Promise.resolve(cached);
        return this.#request('count', collection).then(result => {
            this.#cache.set(cacheKey, result);
            return result;
        });
    }

    listCollections() {
        return this.#request('list-collections');
    }

    deleteCollection(collection) {
        this.#cache.invalidatePrefix(collection);
        return this.#request('delete-collection', collection);
    }

    listPaginated(collection, options = {}) {
        return this.#request('list-paginated', collection, {
            limit: options.limit || 20,
            offset: options.offset || 0,
            page: options.page || 0,
            cursor: options.cursor || '',
            sort: options.sort || [],
        }, null, options.filter || null);
    }

    searchPaginated(collection, query, options = {}) {
        return this.#request('search-paginated', collection, {
            limit: options.limit || 20,
            offset: options.offset || 0,
            page: options.page || 0,
        }, null, query);
    }

    aggregate(collection, stages) {
        return this.#request('aggregate', collection, { stages });
    }

    bulkExecute(operations, options = {}) {
        return this.#request('bulk-execute', null, {
            operations,
            stop_on_error: options.stopOnError || false,
        });
    }

    bulkInsert(collection, documents) {
        this.#cache.invalidatePrefix(`list:${collection}`);
        this.#cache.invalidatePrefix(`count:${collection}`);
        const ops = documents.map(doc => ({ type: 'insert', collection, document: doc }));
        return this.bulkExecute(ops);
    }

    bulkUpdate(collection, updates) {
        this.#cache.invalidatePrefix(collection);
        const ops = Object.entries(updates).map(([id, doc]) => ({
            type: 'update', collection, document_id: id, document: doc,
        }));
        return this.bulkExecute(ops);
    }

    bulkDelete(collection, documentIds) {
        this.#cache.invalidatePrefix(collection);
        const ops = documentIds.map(id => ({ type: 'delete', collection, document_id: id }));
        return this.bulkExecute(ops);
    }

    getProjected(collection, id, projection) {
        return this.#request('get-projected', collection, projection, id);
    }

    searchProjected(collection, query, projection) {
        return this.#request('search-projected', collection, projection, null, query);
    }

    createIndex(collection, field, type = 'hash') {
        return this.#request('create-index', collection, { field, type });
    }

    listIndexes(collection) {
        return this.#request('list-indexes', collection);
    }

    queueInsert(collection, data) {
        this.#batch.add({ type: 'insert', collection, document: data });
    }

    queueUpdate(collection, id, data) {
        this.#batch.add({ type: 'update', collection, document_id: id, document: data });
    }

    queueDelete(collection, id) {
        this.#batch.add({ type: 'delete', collection, document_id: id });
    }

    async flushQueue() {
        await this.#batch.flush();
    }

    clearCache() {
        this.#cache.clear();
    }

    collection(name) {
        return new Collection(this, name);
    }

    helper(name) {
        return new CollectionHelper(this, name);
    }

    query(collection) {
        return new QueryBuilder(this, collection);
    }

    close() {
        this.#shouldReconnect = false;
        this.#reconnect.disable();
        this.#batch.destroy();
        this.#cache.clear();
        if (this.#ping) this.#ping.stop();
        this.#ping = null;
        try { this.#ws?.close(1000, 'Client disconnect'); } catch { }
        this.#ws = null;
        this.#connected = false;
        this.#log.info('Connection closed');
        this.#emit('closed');
    }

    static fromEnv(host) {
        return new NekoDB({
            host: host || process.env.NEKODB_HOST,
            username: process.env.NEKODB_USERNAME,
            password: process.env.NEKODB_PASSWORD,
            key: process.env.NEKODB_KEY,
        });
    }
}

class Collection {
    #db;
    #name;

    constructor(db, name) {
        this.#db = db;
        this.#name = name;
    }

    get name() { return this.#name; }

    insert(document) { return this.#db.insert(this.#name, document); }
    get(id) { return this.#db.get(this.#name, id); }
    list() { return this.#db.list(this.#name); }
    search(query) { return this.#db.search(this.#name, query); }
    update(id, data) { return this.#db.update(this.#name, id, data); }
    delete(id) { return this.#db.delete(this.#name, id); }
    count() { return this.#db.count(this.#name); }
    drop() { return this.#db.deleteCollection(this.#name); }
    listPaginated(options) { return this.#db.listPaginated(this.#name, options); }
    searchPaginated(query, options) { return this.#db.searchPaginated(this.#name, query, options); }
    aggregate(stages) { return this.#db.aggregate(this.#name, stages); }
    bulkInsert(documents) { return this.#db.bulkInsert(this.#name, documents); }
    bulkUpdate(updates) { return this.#db.bulkUpdate(this.#name, updates); }
    bulkDelete(ids) { return this.#db.bulkDelete(this.#name, ids); }
    getProjected(id, projection) { return this.#db.getProjected(this.#name, id, projection); }
    searchProjected(query, projection) { return this.#db.searchProjected(this.#name, query, projection); }
    createIndex(field, type) { return this.#db.createIndex(this.#name, field, type); }
    listIndexes() { return this.#db.listIndexes(this.#name); }
    queueInsert(data) { this.#db.queueInsert(this.#name, data); }
    queueUpdate(id, data) { this.#db.queueUpdate(this.#name, id, data); }
    queueDelete(id) { this.#db.queueDelete(this.#name, id); }
    query() { return new QueryBuilder(this.#db, this.#name); }
    helper() { return new CollectionHelper(this.#db, this.#name); }
}

module.exports = NekoDB;
module.exports.NekoDB = NekoDB;
module.exports.Collection = Collection;
module.exports.AuthManager = AuthManager;
module.exports.QueryBuilder = QueryBuilder;
module.exports.Schema = Schema;
module.exports.EventBus = EventBus;
module.exports.CollectionHelper = CollectionHelper;
module.exports.ConnectionManager = ConnectionManager;
module.exports.errors = errors;
