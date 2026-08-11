const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { AuthManager } = require('./auth');
const { BufferManager, PingManager, ReconnectManager, ResponseCache, BatchCollector, Logger } = require('./middleware');
const { QueryBuilder } = require('./query');
const { matchesQuery, sortDocuments } = require('./query/matcher');
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
    #hostClean;
    #sendQueue;

    constructor({ host, username, password, cache, logging }) {
        this.#host = host;
        let clean = host;
        if (clean.startsWith('wss://')) {
            clean = clean.slice(6);
        } else if (clean.startsWith('https://')) {
            clean = clean.slice(8);
        }
        this.#hostClean = clean;

        this.#auth = new AuthManager(username, password);
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
        this.#sendQueue = Promise.resolve();

        this.#init();

        process.once('SIGINT', () => { this.close(); process.exit(); });
        process.once('SIGTERM', () => { this.close(); process.exit(); });
    }

    #init() {
        try {
            this.#ws = new WebSocket(`wss://${this.#hostClean}`);
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

            this.#ping = new PingManager(() => {
                if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
                    try {
                        const payload = {
                            auth: this.#auth.getCredentials(),
                            action: 'ping'
                        };
                        this.#ws.send(Buffer.from(JSON.stringify(payload)));
                    } catch (e) { }
                }
            });
            this.#ping.start();

            this.#log.info('Connected to', this.#host);
            this.#resolveConnected(true);
            this.#emit('connected');
        });

        this.#ws.on('message', (msg) => {
            const raw = msg.toString();
            if (raw.trim() === 'pong') {
                return;
            }
            if (raw.trim().startsWith('{')) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.action === 'ping' || parsed.event === 'pong') {
                        return;
                    }
                    if (parsed.event && parsed.collection) {
                        this.#invalidateCacheFromEvent(parsed.collection, parsed.event, parsed.document_id || parsed.document?._id);
                        this.#emit(`${parsed.collection}:${parsed.event}`, parsed);
                        this.#emit('change', parsed);
                        return;
                    }
                } catch (e) { }
            }
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

        const result = this.#sendQueue.then(() => {
            return new Promise((resolve, reject) => {
                this.#buffer.clear();
                this.#ws.send(Buffer.from(JSON.stringify(payload)));

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
        });

        this.#sendQueue = result.catch(() => { });
        return result;
    }

    #request(action, collection, document, documentId, query) {
        const payload = { auth: this.#auth.getCredentials(), action };
        if (collection) payload.collection = collection;
        if (document) payload.document = document;
        if (documentId) payload.document_id = documentId;
        if (query) payload.query = query;
        return this.#send(payload).then(result => {
            if (typeof result === 'string') {
                const cleaned = result.trim();
                const err = errors.classify(cleaned);
                if (err) {
                    if (err instanceof errors.NotFoundError) {
                        err.collection = collection;
                        err.documentId = documentId;
                        err.message = `Document not found: ${collection}/${documentId}`;
                    }
                    throw err;
                }
            }
            return result;
        });
    }

    #invalidateCacheFromEvent(collection, event, docId) {
        if (event === 'insert') {
            this.#cache.invalidatePrefix(`list:${collection}`);
            this.#cache.invalidatePrefix(`count:${collection}`);
        } else if (event === 'update') {
            if (docId) {
                this.#cache.invalidate(`get:${collection}:${docId}`);
            }
            this.#cache.invalidatePrefix(`list:${collection}`);
        } else if (event === 'delete') {
            if (docId) {
                this.#cache.invalidate(`get:${collection}:${docId}`);
            }
            this.#cache.invalidatePrefix(`list:${collection}`);
            this.#cache.invalidatePrefix(`count:${collection}`);
        }
        this.#log.debug(`L1 cache invalidated from real-time event: ${collection}:${event} ${docId || ''}`);
    }

    #httpGet(path, params) {
        return new Promise((resolve, reject) => {
            const client = https;
            const defaultPort = 443;
            const hostParts = this.#hostClean.split(':');
            const hostname = hostParts[0];
            const port = hostParts[1] ? parseInt(hostParts[1], 10) : defaultPort;

            const query = Object.entries(params)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');

            const options = {
                hostname,
                port,
                path: `${path}?${query}`,
                method: 'GET'
            };

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        reject(new Error(`HTTP Error ${res.statusCode}: ${data}`));
                    } else {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve(data);
                        }
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.end();
        });
    }

    #httpDownload(path, params, outputPath) {
        return new Promise((resolve, reject) => {
            const client = https;
            const defaultPort = 443;
            const hostParts = this.#hostClean.split(':');
            const hostname = hostParts[0];
            const port = hostParts[1] ? parseInt(hostParts[1], 10) : defaultPort;

            const query = Object.entries(params)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');

            const options = {
                hostname,
                port,
                path: `${path}?${query}`,
                method: 'GET'
            };

            const req = client.request(options, (res) => {
                if (res.statusCode >= 400) {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        reject(new Error(`HTTP Error ${res.statusCode}: ${data}`));
                    });
                    return;
                }

                const fileStream = fs.createWriteStream(outputPath);
                res.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(outputPath);
                });

                fileStream.on('error', (err) => {
                    fs.unlink(outputPath, () => { });
                    reject(err);
                });
            });

            req.on('error', (err) => reject(err));
            req.end();
        });
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

    insert(collection, data, optionsOrTxId) {
        this.#cache.invalidatePrefix(`list:${collection}`);
        this.#cache.invalidatePrefix(`count:${collection}`);
        this.#log.debug('insert', collection);
        let query = null;
        if (typeof optionsOrTxId === 'string') {
            query = { transaction_id: optionsOrTxId };
        } else if (optionsOrTxId && typeof optionsOrTxId === 'object') {
            query = {};
            if (optionsOrTxId.transactionId) query.transaction_id = optionsOrTxId.transactionId;
            if (optionsOrTxId.transaction_id) query.transaction_id = optionsOrTxId.transaction_id;
            if (optionsOrTxId.ttl) query.ttl = optionsOrTxId.ttl;
            if (optionsOrTxId._ttl) query._ttl = optionsOrTxId._ttl;
        }
        return this.#request('insert', collection, data, null, query);
    }

    insertTTL(collection, data, ttlSeconds, transactionId) {
        return this.insert(collection, data, { ttl: ttlSeconds, transactionId });
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

    vectorSearch(collection, { field, vector, metric = 'cosine', topK = 5 } = {}) {
        return this.#request('vector-search', collection, {
            field,
            vector,
            metric,
            top_k: topK
        });
    }

    ftsSearch(collection, { field, query, limit = 10 } = {}) {
        return this.#request('fts-search', collection, {
            field,
            query,
            limit
        });
    }

    update(collection, id, data, transactionId) {
        this.#cache.invalidate(`get:${collection}:${id}`);
        this.#cache.invalidatePrefix(`list:${collection}`);
        this.#log.debug('update', collection, id);
        const query = transactionId ? { transaction_id: transactionId } : null;
        return this.#request('update', collection, data, id, query);
    }

    delete(collection, id, transactionId) {
        this.#cache.invalidate(`get:${collection}:${id}`);
        this.#cache.invalidatePrefix(`list:${collection}`);
        this.#cache.invalidatePrefix(`count:${collection}`);
        this.#log.debug('delete', collection, id);
        const query = transactionId ? { transaction_id: transactionId } : null;
        return this.#request('delete', collection, null, id, query);
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

    registerSchema(collection, schemaConfig) {
        return this.#request('register-schema', collection, schemaConfig);
    }

    createSnapshot() {
        return this.#request('snapshot-create');
    }

    restoreSnapshot(filename) {
        return this.#request('snapshot-restore', null, { filename });
    }

    subscribe(collection, handler) {
        this.on(`${collection}:insert`, handler);
        this.on(`${collection}:update`, handler);
        this.on(`${collection}:delete`, handler);
        return this.#request('subscribe', collection);
    }

    watch(collection, query, callback, options = {}) {
        const projection = options.projection || null;
        const sortFields = options.sort || [];
        const limitVal = options.limit || 0;

        let docs = [];
        let initialized = false;
        const queue = [];

        const processEvent = async (eventPayload) => {
            const { event, document_id, document } = eventPayload;

            if (event === 'insert') {
                const doc = document || {};
                const fullDoc = { _id: document_id, ...doc };
                if (matchesQuery(fullDoc, query)) {
                    const idx = docs.findIndex(d => d._id === document_id);
                    if (idx !== -1) {
                        docs[idx] = fullDoc;
                    } else {
                        docs.push(fullDoc);
                    }
                    if (sortFields.length > 0) {
                        docs = sortDocuments(docs, sortFields);
                    }
                    if (limitVal > 0) {
                        docs = docs.slice(0, limitVal);
                    }
                    callback(docs);
                }
            } else if (event === 'update') {
                const docDelta = document || {};
                const idx = docs.findIndex(d => d._id === document_id);

                if (idx !== -1) {
                    const fullDoc = { ...docs[idx], ...docDelta };
                    if (matchesQuery(fullDoc, query)) {
                        docs[idx] = fullDoc;
                        if (sortFields.length > 0) {
                            docs = sortDocuments(docs, sortFields);
                        }
                        if (limitVal > 0) {
                            docs = docs.slice(0, limitVal);
                        }
                        callback(docs);
                    } else {
                        docs.splice(idx, 1);
                        if (limitVal > 0 && docs.length < limitVal) {
                            try {
                                const refreshed = await this.searchProjected(collection, query, projection);
                                if (Array.isArray(refreshed)) {
                                    docs = refreshed;
                                    if (sortFields.length > 0) {
                                        docs = sortDocuments(docs, sortFields);
                                    }
                                    if (limitVal > 0) {
                                        docs = docs.slice(0, limitVal);
                                    }
                                }
                            } catch (e) {
                                this.#log.error('Watch auto-replenish failed:', e.message);
                            }
                        }
                        callback(docs);
                    }
                } else {
                    const queryKeys = Object.keys(query || {});
                    const hasQueryField = queryKeys.length === 0 || Object.keys(docDelta).some(k => queryKeys.includes(k));

                    if (hasQueryField) {
                        try {
                            const fullDoc = await this.get(collection, document_id);
                            if (fullDoc && fullDoc !== 'not-found' && matchesQuery({ _id: document_id, ...fullDoc }, query)) {
                                docs.push({ _id: document_id, ...fullDoc });
                                if (sortFields.length > 0) {
                                    docs = sortDocuments(docs, sortFields);
                                }
                                if (limitVal > 0) {
                                    docs = docs.slice(0, limitVal);
                                }
                                callback(docs);
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            } else if (event === 'delete') {
                const idx = docs.findIndex(d => d._id === document_id);
                if (idx !== -1) {
                    docs.splice(idx, 1);
                    if (limitVal > 0 && docs.length < limitVal) {
                        try {
                            const refreshed = await this.searchProjected(collection, query, projection);
                            if (Array.isArray(refreshed)) {
                                docs = refreshed;
                                if (sortFields.length > 0) {
                                    docs = sortDocuments(docs, sortFields);
                                }
                                if (limitVal > 0) {
                                    docs = docs.slice(0, limitVal);
                                }
                            }
                        } catch (e) {
                            this.#log.error('Watch auto-replenish failed:', e.message);
                        }
                    }
                    callback(docs);
                }
            }
        };

        const handleEvent = (eventPayload) => {
            if (!initialized) {
                queue.push(eventPayload);
                return;
            }
            processEvent(eventPayload);
        };

        this.subscribe(collection, handleEvent);

        this.searchProjected(collection, query, projection)
            .then(initialDocs => {
                if (Array.isArray(initialDocs)) {
                    docs = initialDocs;
                    if (sortFields.length > 0) {
                        docs = sortDocuments(docs, sortFields);
                    }
                    if (limitVal > 0) {
                        docs = docs.slice(0, limitVal);
                    }
                }
                initialized = true;
                for (const ev of queue) {
                    processEvent(ev);
                }
                callback(docs);
            })
            .catch(err => {
                this.#log.error('Watch initial fetch failed:', err.message);
                initialized = true;
                callback([]);
            });

        return {
            close: () => {
                const insertEvent = `${collection}:insert`;
                const updateEvent = `${collection}:update`;
                const deleteEvent = `${collection}:delete`;

                if (this.#events[insertEvent]) {
                    this.#events[insertEvent] = this.#events[insertEvent].filter(h => h !== handleEvent);
                }
                if (this.#events[updateEvent]) {
                    this.#events[updateEvent] = this.#events[updateEvent].filter(h => h !== handleEvent);
                }
                if (this.#events[deleteEvent]) {
                    this.#events[deleteEvent] = this.#events[deleteEvent].filter(h => h !== handleEvent);
                }
            }
        };
    }

    async beginTransaction() {
        const res = await this.#request('transaction-begin');
        if (typeof res === 'string' && res.startsWith('transaction-started: ')) {
            return res.split('transaction-started: ')[1].trim();
        }
        return res;
    }

    commitTransaction(transactionId) {
        return this.#request('transaction-commit', null, { transaction_id: transactionId });
    }

    rollbackTransaction(transactionId) {
        return this.#request('transaction-rollback', null, { transaction_id: transactionId });
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

    exportCSV(collection, docId) {
        if (!collection) throw new Error('missing required parameter: collection');
        if (!docId) throw new Error('missing required parameter: doc_id');
        return this.#httpGet('/api/export/csv', {
            user: this.#auth.getCredentials().username,
            collection,
            doc_id: docId
        });
    }

    exportJSON(collection, docId) {
        if (!collection) throw new Error('missing required parameter: collection');
        if (!docId) throw new Error('missing required parameter: doc_id');
        return this.#httpGet('/api/export/json', {
            user: this.#auth.getCredentials().username,
            collection,
            doc_id: docId
        });
    }

    downloadExport(filename, outputPath) {
        return this.#httpDownload('/api/export/download', {
            user: this.#auth.getCredentials().username,
            filename
        }, outputPath);
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

    insert(document, optionsOrTxId) { return this.#db.insert(this.#name, document, optionsOrTxId); }
    insertTTL(document, ttlSeconds, transactionId) { return this.#db.insertTTL(this.#name, document, ttlSeconds, transactionId); }
    get(id) { return this.#db.get(this.#name, id); }
    list() { return this.#db.list(this.#name); }
    search(query) { return this.#db.search(this.#name, query); }
    vectorSearch(options) { return this.#db.vectorSearch(this.#name, options); }
    ftsSearch(options) { return this.#db.ftsSearch(this.#name, options); }
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
    exportCSV(docId) {
        if (!docId) throw new Error('missing required parameter: doc_id');
        return this.#db.exportCSV(this.#name, docId);
    }
    exportJSON(docId) {
        if (!docId) throw new Error('missing required parameter: doc_id');
        return this.#db.exportJSON(this.#name, docId);
    }
    query() { return new QueryBuilder(this.#db, this.#name); }
    helper() { return new CollectionHelper(this.#db, this.#name); }
    watch(query, callback) { return this.#db.watch(this.#name, query, callback); }
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
