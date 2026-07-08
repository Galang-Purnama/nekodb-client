const { FieldQuery } = require('./field');

class QueryBuilder {
    #db;
    #collection;
    #conditions;
    #projection;
    #sortFields;
    #limitVal;
    #offsetVal;
    #pageVal;
    #cursorVal;

    constructor(db, collection) {
        this.#db = db;
        this.#collection = collection;
        this.#conditions = {};
        this.#projection = null;
        this.#sortFields = [];
        this.#limitVal = 0;
        this.#offsetVal = 0;
        this.#pageVal = 0;
        this.#cursorVal = '';
    }

    where(field) {
        return new FieldQuery(this, field);
    }

    eq(field, value) {
        this.#conditions[field] = value;
        return this;
    }

    gt(field, value) {
        this._addOp(field, '$gt', value);
        return this;
    }

    gte(field, value) {
        this._addOp(field, '$gte', value);
        return this;
    }

    lt(field, value) {
        this._addOp(field, '$lt', value);
        return this;
    }

    lte(field, value) {
        this._addOp(field, '$lte', value);
        return this;
    }

    ne(field, value) {
        this._addOp(field, '$ne', value);
        return this;
    }

    in(field, values) {
        this._addOp(field, '$in', values);
        return this;
    }

    nin(field, values) {
        this._addOp(field, '$nin', values);
        return this;
    }

    between(field, min, max) {
        this._addOp(field, '$gte', min);
        this._addOp(field, '$lte', max);
        return this;
    }

    regex(field, pattern) {
        this._addOp(field, '$regex', pattern);
        return this;
    }

    _addOp(field, op, value) {
        if (typeof this.#conditions[field] !== 'object' || this.#conditions[field] === null) {
            this.#conditions[field] = {};
        }
        this.#conditions[field][op] = value;
    }

    select(...fields) {
        this.#projection = {};
        for (const f of fields) {
            this.#projection[f] = 1;
        }
        return this;
    }

    exclude(...fields) {
        this.#projection = {};
        for (const f of fields) {
            this.#projection[f] = 0;
        }
        return this;
    }

    sort(field, order = 'asc') {
        this.#sortFields.push({ field, order });
        return this;
    }

    sortAsc(field) { return this.sort(field, 'asc'); }
    sortDesc(field) { return this.sort(field, 'desc'); }

    limit(n) {
        this.#limitVal = n;
        return this;
    }

    offset(n) {
        this.#offsetVal = n;
        return this;
    }

    page(n) {
        this.#pageVal = n;
        return this;
    }

    cursor(c) {
        this.#cursorVal = c;
        return this;
    }

    getQuery() {
        return { ...this.#conditions };
    }

    getProjection() {
        return this.#projection ? { ...this.#projection } : null;
    }

    getPaginationOptions() {
        const opts = {};
        if (this.#limitVal > 0) opts.limit = this.#limitVal;
        if (this.#offsetVal > 0) opts.offset = this.#offsetVal;
        if (this.#pageVal > 0) opts.page = this.#pageVal;
        if (this.#cursorVal) opts.cursor = this.#cursorVal;
        if (this.#sortFields.length > 0) opts.sort = [...this.#sortFields];
        return opts;
    }

    async exec() {
        const query = this.getQuery();
        const hasQuery = Object.keys(query).length > 0;
        const hasPagination = this.#limitVal > 0 || this.#pageVal > 0 || this.#cursorVal;
        const hasProjection = this.#projection !== null;

        if (hasPagination && hasQuery) {
            return this.#db.searchPaginated(this.#collection, query, this.getPaginationOptions());
        }
        if (hasPagination) {
            return this.#db.listPaginated(this.#collection, {
                ...this.getPaginationOptions(),
                filter: hasQuery ? query : null,
            });
        }
        if (hasProjection && hasQuery) {
            return this.#db.searchProjected(this.#collection, query, this.#projection);
        }
        if (hasQuery) {
            return this.#db.search(this.#collection, query);
        }
        return this.#db.list(this.#collection);
    }

    async count() {
        return this.#db.count(this.#collection);
    }

    async first() {
        const results = await this.limit(1).exec();
        if (Array.isArray(results)) return results[0] || null;
        if (results?.data) return results.data[0] || null;
        return results;
    }

    watch(callback) {
        return this.#db.watch(this.#collection, this.getQuery(), callback, {
            projection: this.getProjection(),
            sort: this.#sortFields,
            limit: this.#limitVal,
        });
    }
}

module.exports = { QueryBuilder };
