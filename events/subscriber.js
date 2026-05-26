class Subscription {
    #bus;
    #event;
    #handler;

    constructor(bus, event, handler) {
        this.#bus = bus;
        this.#event = event;
        this.#handler = handler;
    }

    unsubscribe() {
        if (this.#bus) {
            this.#bus.off(this.#event, this.#handler);
            this.#bus = null;
            this.#handler = null;
        }
    }
}

module.exports = { Subscription };
