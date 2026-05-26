const { sha256 } = require('./key-derivation');

class AuthManager {
    #username;
    #password;
    #key;

    constructor(username, password, key) {
        this.#username = username || '';
        this.#password = password || '';
        if (key) {
            this.#key = key;
        } else if (this.#username) {
            this.#key = sha256(this.#username);
        } else {
            this.#key = '';
        }
    }

    getCredentials() {
        return {
            username: this.#username,
            password: this.#password,
            key: this.#key,
        };
    }

    getUsername() {
        return this.#username;
    }

    static fromEnv() {
        return new AuthManager(
            process.env.NEKODB_USERNAME,
            process.env.NEKODB_PASSWORD,
            process.env.NEKODB_KEY
        );
    }

    static fromConfig(config) {
        return new AuthManager(config.username, config.password, config.key);
    }
}

module.exports = { AuthManager };
