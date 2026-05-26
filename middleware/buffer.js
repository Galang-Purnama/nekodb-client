class BufferManager {
    #buffer;
    #delimiter;

    constructor(delimiter = '\n') {
        this.#buffer = '';
        this.#delimiter = delimiter;
    }

    append(data) {
        this.#buffer += data.toString();
    }

    hasComplete() {
        return this.#buffer.includes(this.#delimiter);
    }

    extract() {
        const data = this.#buffer.trim();
        this.#buffer = '';
        return data;
    }

    clear() {
        this.#buffer = '';
    }

    get length() {
        return this.#buffer.length;
    }
}

module.exports = { BufferManager };
