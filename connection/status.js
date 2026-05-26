const ConnectionStatus = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
};

class ConnectionHealth {
    static check(instance) {
        if (!instance) return ConnectionStatus.DISCONNECTED;
        return instance.connected ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED;
    }
}

module.exports = {
    ConnectionStatus,
    ConnectionHealth,
};
