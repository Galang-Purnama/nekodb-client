class FieldQuery {
    #builder;
    #field;

    constructor(builder, field) {
        this.#builder = builder;
        this.#field = field;
    }

    eq(value) { return this.#builder.eq(this.#field, value); }
    gt(value) { return this.#builder.gt(this.#field, value); }
    gte(value) { return this.#builder.gte(this.#field, value); }
    lt(value) { return this.#builder.lt(this.#field, value); }
    lte(value) { return this.#builder.lte(this.#field, value); }
    ne(value) { return this.#builder.ne(this.#field, value); }
    in(values) { return this.#builder.in(this.#field, values); }
    nin(values) { return this.#builder.nin(this.#field, values); }
    between(min, max) { return this.#builder.between(this.#field, min, max); }
    regex(pattern) { return this.#builder.regex(this.#field, pattern); }
}

module.exports = { FieldQuery };
