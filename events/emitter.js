const { Subscription } = require('./subscriber');
const { Events } = require('./constants');

class EventBus {
    #listeners;
    #onceFlags;
    #maxListeners;

    constructor(maxListeners = 50) {
        this.#listeners = new Map();
        this.#onceFlags = new WeakSet();
        this.#maxListeners = maxListeners;
    }

    on(event, handler) {
        if (typeof handler !== 'function') throw new TypeError('Handler must be a function');
        if (!this.#listeners.has(event)) this.#listeners.set(event, []);
        const handlers = this.#listeners.get(event);
        if (handlers.length >= this.#maxListeners) {
            console.warn(`[EventBus] Max listeners (${this.#maxListeners}) reached for "${event}"`);
        }
        handlers.push(handler);
        return new Subscription(this, event, handler);
    }

    once(event, handler) {
        if (typeof handler !== 'function') throw new TypeError('Handler must be a function');
        const wrapper = (...args) => {
            this.off(event, wrapper);
            handler(...args);
        };
        this.#onceFlags.add(wrapper);
        this.on(event, wrapper);
        return new Subscription(this, event, wrapper);
    }

    off(event, handler) {
        if (!handler) {
            this.#listeners.delete(event);
            return this;
        }
        const handlers = this.#listeners.get(event);
        if (handlers) {
            const idx = handlers.indexOf(handler);
            if (idx !== -1) handlers.splice(idx, 1);
            if (handlers.length === 0) this.#listeners.delete(event);
        }
        return this;
    }

    emit(event, ...args) {
        const handlers = this.#listeners.get(event);
        if (!handlers || handlers.length === 0) return false;
        for (const handler of [...handlers]) {
            try { handler(...args); } catch (err) {
                console.error(`[EventBus] Error in "${event}" handler:`, err);
            }
        }

        if (event !== Events.ALL) {
            const wildcardHandlers = this.#listeners.get(Events.ALL);
            if (wildcardHandlers) {
                for (const handler of [...wildcardHandlers]) {
                    try { handler(event, ...args); } catch { }
                }
            }
        }
        return true;
    }

    listenerCount(event) {
        return this.#listeners.get(event)?.length || 0;
    }

    eventNames() {
        return [...this.#listeners.keys()];
    }

    removeAllListeners(event) {
        if (event) {
            this.#listeners.delete(event);
        } else {
            this.#listeners.clear();
        }
        return this;
    }

    waitFor(event, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            let timer;
            const handler = (data) => {
                clearTimeout(timer);
                resolve(data);
            };
            this.once(event, handler);
            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    this.off(event, handler);
                    reject(new Error(`Timeout waiting for "${event}"`));
                }, timeoutMs);
            }
        });
    }
}

module.exports = { EventBus };
