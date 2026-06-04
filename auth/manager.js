class AuthManager {
    #username;
    #password;

    constructor(username, password) {
        this.#username = username || '';
        this.#password = password || '';
    }

    getCredentials() {
        return {
            username: this.#username,
            password: this.#password,
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
