class CollectionHelper {
    #db;
    #collection;

    constructor(db, collectionName) {
        this.#db = db;
        this.#collection = collectionName;
    }

    get name() { return this.#collection; }

    async findOne(query) {
        const ids = await this.#db.search(this.#collection, query);
        if (!Array.isArray(ids) || ids.length === 0) return null;
        return this.#db.get(this.#collection, ids[0]);
    }

    async findById(id) {
        const doc = await this.#db.get(this.#collection, id);
        if (doc === 'not-found' || doc === null) return null;
        return { _id: id, ...doc };
    }

    async exists(id) {
        const doc = await this.#db.get(this.#collection, id);
        return doc !== 'not-found' && doc !== null;
    }

    async findMany(query) {
        const ids = await this.#db.search(this.#collection, query);
        if (!Array.isArray(ids)) return [];
        const docs = [];
        for (const id of ids) {
            const doc = await this.#db.get(this.#collection, id);
            if (doc && doc !== 'not-found') {
                docs.push({ _id: id, ...doc });
            }
        }
        return docs;
    }

    async getAll() {
        const ids = await this.#db.list(this.#collection);
        if (!Array.isArray(ids)) return [];
        const docs = [];
        for (const id of ids) {
            const doc = await this.#db.get(this.#collection, id);
            if (doc && doc !== 'not-found') {
                docs.push({ _id: id, ...doc });
            }
        }
        return docs;
    }

    async upsert(query, data) {
        const ids = await this.#db.search(this.#collection, query);
        if (Array.isArray(ids) && ids.length > 0) {
            await this.#db.update(this.#collection, ids[0], data);
            return { action: 'updated', id: ids[0] };
        }
        const id = await this.#db.insert(this.#collection, data);
        return { action: 'inserted', id };
    }

    async findOrInsert(query, defaultDoc) {
        const existing = await this.findOne(query);
        if (existing) return { doc: existing, created: false };
        const id = await this.#db.insert(this.#collection, defaultDoc || query);
        const doc = await this.#db.get(this.#collection, id);
        return { doc: { _id: id, ...doc }, created: true };
    }

    async updateWhere(query, updates) {
        const ids = await this.#db.search(this.#collection, query);
        if (!Array.isArray(ids)) return { matched: 0, modified: 0 };
        let modified = 0;
        for (const id of ids) {
            const ok = await this.#db.update(this.#collection, id, updates);
            if (ok !== 'not-found') modified++;
        }
        return { matched: ids.length, modified };
    }

    async deleteWhere(query) {
        const ids = await this.#db.search(this.#collection, query);
        if (!Array.isArray(ids)) return { deleted: 0 };
        let deleted = 0;
        for (const id of ids) {
            const ok = await this.#db.delete(this.#collection, id);
            if (ok !== 'not-found') deleted++;
        }
        return { deleted };
    }

    async replaceOne(id, doc) {
        const existing = await this.#db.get(this.#collection, id);
        if (!existing || existing === 'not-found') return false;
        await this.#db.delete(this.#collection, id);
        await this.#db.insert(this.#collection, { _original_id: id, ...doc });
        return true;
    }

    async insertMany(docs) {
        return this.#db.bulkInsert(this.#collection, docs);
    }

    async deleteMany(ids) {
        return this.#db.bulkDelete(this.#collection, ids);
    }

    async *paginate(options = {}) {
        const pageSize = options.limit || 20;
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const result = await this.#db.listPaginated(this.#collection, {
                limit: pageSize,
                page,
                sort: options.sort || [],
                filter: options.filter || null,
            });

            if (result?.data) {
                yield { page, data: result.data, pageInfo: result.page_info };
            }

            hasMore = result?.page_info?.has_next || false;
            page++;
        }
    }

    async forEach(query, callback) {
        const docs = await this.findMany(query);
        for (let i = 0; i < docs.length; i++) {
            await callback(docs[i], i);
        }
    }

    async map(query, transform) {
        const docs = await this.findMany(query);
        return docs.map(transform);
    }

    async filter(query, predicate) {
        const docs = await this.findMany(query);
        return docs.filter(predicate);
    }
}

module.exports = { CollectionHelper };
