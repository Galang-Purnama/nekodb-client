class CursorNavigator {
    #db;
    #collection;
    #query;
    #limit;
    #nextCursor;
    #prevCursor;

    constructor(db, collectionName, options = {}) {
        this.#db = db;
        this.#collection = collectionName;
        this.#query = options.query || null;
        this.#limit = options.limit || 20;
        this.#nextCursor = '';
        this.#prevCursor = '';
    }

    async next() {
        const result = await this.#db.listPaginated(this.#collection, {
            limit: this.#limit,
            cursor: this.#nextCursor,
            filter: this.#query,
        });

        if (result?.page_info) {
            this.#nextCursor = result.page_info.next_cursor || '';
            this.#prevCursor = result.page_info.prev_cursor || '';
        }

        return result?.data || [];
    }

    async prev() {
        if (!this.#prevCursor) return [];

        const result = await this.#db.listPaginated(this.#collection, {
            limit: this.#limit,
            cursor: this.#prevCursor,
            filter: this.#query,
        });

        if (result?.page_info) {
            this.#nextCursor = result.page_info.next_cursor || '';
            this.#prevCursor = result.page_info.prev_cursor || '';
        }

        return result?.data || [];
    }

    get hasNext() {
        return !!this.#nextCursor;
    }

    get hasPrev() {
        return !!this.#prevCursor;
    }
}

module.exports = { CursorNavigator };
