# NekoDB

> Secure, resilient document database with high availability and seamless real-time data access.

## Install

```bash
npm install @nekodb/client
```

## Quick Start

```javascript
const NekoDB = require('@nekodb/client');

const db = new NekoDB({
    host: 'your-server.com',
    username: 'Username',
    password: 'Password',
    // key: 'Key', // Optional: automatically derived as SHA-256 of username
});

const id = await db.insert('users', { name: 'Neko', age: 5 });
const doc = await db.get('users', id);
const results = await db.search('users', { name: 'Neko' });
await db.update('users', id, { age: 6 });
await db.delete('users', id);

db.close();
```

## Why NekoDB?

| Feature | NekoDB | MongoDB | Firebase | SQLite |
|---------|--------|---------|----------|--------|
| **AES-256 Encryption** | ✅ Built-in | ❌ | ❌ | ❌ |
| **Multi-Node Auto-Failover** | ✅ | Manual setup | N/A | ❌ |
| **Zero Disk Overflow** | ✅ 99% auto-migrate | ❌ | N/A | ❌ |
| **WebSocket Real-time** | ✅ | Change Streams | ✅ | ❌ |
| **Binary WebSocket Protocol** | ✅ | ❌ | ❌ | ❌ |
| **No Schema Required** | ✅ | ✅ | ✅ | ❌ |
| **Aggregation Pipeline** | ✅ | ✅ | Limited | ❌ |
| **Bulk Operations** | ✅ Parallel | ✅ | ✅ | ❌ |
| **Auto-Reconnect** | ✅ Built-in | Manual | Built-in | N/A |
| **Data Encrypted at Rest** | ✅ AES-256-GCM | Enterprise only | ✅ | ❌ |

## Connection

```javascript
const NekoDB = require('@nekodb/client');

const db = new NekoDB({
    host: 'your-server.com',
    username: 'your_username',
    password: 'your_password',
    // key: 'your_key', // Optional: automatically derived as SHA-256 of username
});

// From environment variables (NEKODB_HOST, NEKODB_USERNAME, NEKODB_PASSWORD, NEKODB_KEY)
const db = NekoDB.fromEnv();
```

## Events

```javascript
db.on('connected', () => console.log('Connected!'));
db.on('disconnected', (info) => console.log('Disconnected:', info));
db.on('reconnected', () => console.log('Reconnected!'));
db.on('reconnect_failed', () => console.log('Could not reconnect'));
db.on('error', (err) => console.error('Error:', err));
db.on('closed', () => console.log('Connection closed'));
```

## Collection API

Use `db.collection()` for a cleaner syntax:

```javascript
const users = db.collection('users');

await users.insert({ name: 'Neko', role: 'admin' });
const doc = await users.get('doc-id');
const all = await users.list();
const found = await users.search({ role: 'admin' });
await users.update('doc-id', { role: 'superadmin' });
await users.delete('doc-id');
const total = await users.count();
await users.drop();
```

## CRUD Operations

### Insert

```javascript
const docId = await db.insert('products', {
    name: 'Laptop',
    price: 999,
    tags: ['electronics', 'computers'],
});
```

### Get

```javascript
const product = await db.get('products', docId);
```

### List

```javascript
const allIds = await db.list('products');
```

### Search

```javascript
// Exact match
await db.search('products', { name: 'Laptop' });

// Comparison operators: $gt, $gte, $lt, $lte, $eq, $ne, $in, $nin
await db.search('products', { price: { $gt: 500 } });
await db.search('products', { price: { $gte: 100, $lte: 1000 } });
await db.search('products', { category: { $in: ['electronics', 'software'] } });
```

### Update

```javascript
await db.update('products', docId, { price: 899 });
```

### Delete

```javascript
await db.delete('products', docId);
```

### Count

```javascript
const result = await db.count('products');
```

### List Collections

```javascript
const collections = await db.listCollections();
```

### Delete Collection

```javascript
await db.deleteCollection('temp_data');
```

## Query Builder

Build queries with a chainable, fluent API:

```javascript
const users = db.collection('users');

// Simple query
const results = await users.query()
    .where('age').gt(18)
    .where('role').eq('admin')
    .exec();

// With sorting and pagination
const page = await users.query()
    .where('status').eq('active')
    .sort('name', 'asc')
    .limit(20)
    .page(1)
    .exec();

// Range query
const products = await db.query('products')
    .between('price', 100, 500)
    .sortDesc('price')
    .limit(10)
    .exec();

// Select specific fields (projection)
const names = await users.query()
    .where('role').eq('admin')
    .select('name', 'email')
    .exec();

// Exclude specific fields
const safe = await users.query()
    .exclude('password', 'secret')
    .exec();

// Get first match only
const first = await users.query()
    .where('email').eq('admin@example.com')
    .first();

// In / Not In
const results = await users.query()
    .where('role').in(['admin', 'moderator'])
    .where('status').ne('banned')
    .exec();
```

## Collection Helpers

High-level helper methods for common operations:

```javascript
const users = db.collection('users').helper();

// Find single document matching query
const admin = await users.findOne({ role: 'admin' });

// Find by ID (returns doc with _id)
const user = await users.findById('doc-id');

// Check if document exists
const exists = await users.exists('doc-id');

// Find all matching documents (returns full docs, not just IDs)
const admins = await users.findMany({ role: 'admin' });

// Get all documents in collection
const allUsers = await users.getAll();

// Upsert: update if exists, insert if not
const result = await users.upsert({ email: 'neko@example.com' }, {
    email: 'neko@example.com',
    name: 'Neko',
    role: 'user',
});
// result: { action: 'inserted', id: '...' } or { action: 'updated', id: '...' }

// Find or insert
const { doc, created } = await users.findOrInsert(
    { email: 'neko@example.com' },
    { email: 'neko@example.com', name: 'Neko' }
);

// Update all documents matching query
await users.updateWhere({ role: 'user' }, { verified: true });

// Delete all documents matching query
await users.deleteWhere({ status: 'inactive' });

// Async paginate iterator
for await (const page of users.paginate({ limit: 10 })) {
    console.log(`Page ${page.page}:`, page.data);
    // page.pageInfo.has_next tells if more pages exist
}

// Functional helpers
await users.forEach({ role: 'admin' }, (user, i) => {
    console.log(`Admin ${i}:`, user.name);
});

const names = await users.map({ role: 'admin' }, u => u.name);
const seniors = await users.filter({}, u => u.age > 50);
```

## Schema Validation

Client-side validation before sending data to the server:

```javascript
const { Schema } = require('@nekodb/client');

const userSchema = new Schema({
    name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    email: { type: 'string', required: true, match: /^[^@]+@[^@]+\.[^@]+$/ },
    age: { type: 'number', min: 0, max: 200 },
    role: { type: 'string', enum: ['admin', 'user', 'moderator'] },
    tags: 'array',
}, { strict: true }); // strict: reject unknown fields

// Validate
const { valid, errors } = userSchema.validate({
    name: 'Neko',
    email: 'neko@example.com',
    age: 5,
    role: 'admin',
});

if (!valid) {
    console.error('Validation errors:', errors);
    // [{ field: 'name', rule: 'required', message: '"name" is required' }]
}

// Apply defaults
const withDefaults = userSchema.applyDefaults({ name: 'Neko' });

// Pick/Omit fields
const partial = userSchema.pick(doc, 'name', 'email');
const safe = userSchema.omit(doc, 'password', 'secret');

// Inspect schema
console.log(userSchema.getFieldNames());     // ['name', 'email', 'age', ...]
console.log(userSchema.getRequiredFields());  // ['name', 'email']
```

## Pagination & Sorting

```javascript
// Offset-based
const page1 = await db.listPaginated('products', { limit: 10, offset: 0 });

// Page-based
const page2 = await db.listPaginated('products', { limit: 10, page: 2 });

// With sorting
const sorted = await db.listPaginated('products', {
    limit: 10,
    sort: [{ field: 'price', order: 'desc' }],
});

// Cursor-based
const next = await db.listPaginated('products', {
    limit: 10,
    cursor: page1.page_info.next_cursor,
});

// Search with pagination
const results = await db.searchPaginated('products', { price: { $gt: 100 } }, { limit: 5 });
```

## Aggregation Pipeline

```javascript
const result = await db.aggregate('orders', [
    { type: '$match', params: { status: 'completed' } },
    { type: '$group', params: {
        _id: '$category',
        total: { $sum: '$amount' },
        avg: { $avg: '$amount' },
        count: { $sum: 1 },
    }},
    { type: '$sort', params: { total: -1 } },
    { type: '$limit', params: { value: 5 } },
]);
```

**Stages:** `$match`, `$group`, `$sort`, `$limit`, `$skip`, `$project`, `$count`, `$unwind`

**Accumulators:** `$sum`, `$avg`, `$min`, `$max`, `$count`, `$first`, `$last`, `$push`

## Bulk Operations

```javascript
// Bulk insert
await db.bulkInsert('products', [
    { name: 'Mouse', price: 25 },
    { name: 'Keyboard', price: 75 },
]);

// Bulk update
await db.bulkUpdate('products', {
    'doc-id-1': { price: 30 },
    'doc-id-2': { price: 80 },
});

// Bulk delete
await db.bulkDelete('products', ['doc-id-1', 'doc-id-2']);

// Mixed operations
await db.bulkExecute([
    { type: 'insert', collection: 'logs', document: { event: 'login' } },
    { type: 'update', collection: 'users', document_id: 'abc', document: { active: true } },
    { type: 'delete', collection: 'sessions', document_id: 'old-session' },
]);
```

## Projection

```javascript
// Include only specific fields
const doc = await db.getProjected('users', 'doc-id', { name: 1, email: 1 });

// Exclude specific fields
const doc2 = await db.getProjected('users', 'doc-id', { password: 0 });

// Search with projection
const results = await db.searchProjected('users', { role: 'admin' }, { name: 1, email: 1 });
```

## Indexing

```javascript
await db.createIndex('users', 'email', 'hash');
await db.createIndex('products', 'price', 'sorted');
const indexes = await db.listIndexes('users');
```

## Error Handling

Typed error classes for structured error handling:

```javascript
const { errors } = require('@nekodb/client');

try {
    const doc = await db.get('users', 'non-existent');
} catch (err) {
    if (err instanceof errors.NotFoundError) {
        console.log('Document not found:', err.collection, err.documentId);
    } else if (err instanceof errors.AuthError) {
        console.log('Authentication failed');
    } else if (err instanceof errors.TimeoutError) {
        console.log('Request timed out after', err.durationMs, 'ms');
    } else if (err instanceof errors.ConnectionError) {
        console.log('Connection error to', err.host);
    }
}

// Classify raw server response into typed error
const error = errors.classify('invalid-credentials'); // returns AuthError
const error2 = errors.classify('not-found');           // returns NotFoundError
```

**Available error classes:** `NekoError`, `ConnectionError`, `TimeoutError`, `AuthError`, `NotFoundError`, `ValidationError`, `BulkOperationError`, `CollectionError`

## Event Bus

Enhanced event emitter with wildcards and promise support:

```javascript
const { EventBus } = require('@nekodb/client');

const bus = new EventBus();

// Standard events
bus.on('user:created', (user) => console.log('Created:', user));
bus.on('user:deleted', (user) => console.log('Deleted:', user));

// Wildcard — listen to ALL events
bus.on('*', (eventName, data) => console.log('Event:', eventName, data));

// Once — fire only once
bus.once('db:ready', () => console.log('Database ready'));

// Remove listener
const handler = (data) => console.log(data);
bus.on('test', handler);
bus.off('test', handler);

// Wait for event (promise-based)
const data = await bus.waitFor('user:created', 5000); // 5s timeout

// Emit
bus.emit('user:created', { name: 'Neko' });
```

## Connection Manager

Manage multiple NekoDB connections:

```javascript
const { ConnectionManager } = require('@nekodb/client');

const manager = new ConnectionManager();

// Add connections
manager.add('primary', new NekoDB({ host: 'server1.com', ... }));
manager.add('secondary', new NekoDB({ host: 'server2.com', ... }));

// Use active connection
const db = manager.active();
await db.insert('logs', { event: 'test' });

// Switch active connection
manager.setActive('secondary');

// Health management
const healthy = manager.getHealthy();     // ['primary']
const unhealthy = manager.getUnhealthy(); // ['secondary']
manager.switchToHealthy();                // auto-switch to healthy node

// Stats & info
console.log(manager.list());
// [{ id: 'primary', connected: true, isActive: true, ... }, ...]

console.log(manager.getStats());
// { total: 2, connected: 1, disconnected: 1, activeId: 'primary' }

// Cleanup
await manager.closeAll();
```

## Full Example

```javascript
const NekoDB = require('@nekodb/client');
const { Schema } = require('@nekodb/client');

async function main() {
    const db = new NekoDB({
        host: 'your-server.com',
        username: 'Username',
        password: 'Password',
        // key: 'Key', // Optional: automatically derived as SHA-256 of username
    });

    db.on('connected', () => console.log('✅ Connected'));
    db.on('error', (err) => console.error('❌', err));

    // Define schema
    const userSchema = new Schema({
        name: { type: 'string', required: true },
        age: { type: 'number', min: 0 },
        role: { type: 'string', enum: ['admin', 'user'] },
    });

    // Validate before insert
    const data = { name: 'Alice', age: 30, role: 'admin' };
    const { valid, errors } = userSchema.validate(data);
    if (!valid) return console.error('Invalid:', errors);

    const users = db.collection('users');
    const id = await users.insert(data);

    // Query builder
    const admins = await users.query()
        .where('role').eq('admin')
        .where('age').gte(18)
        .sortDesc('age')
        .limit(10)
        .exec();
    console.log('Admins:', admins);

    // Collection helpers
    const helper = users.helper();
    const alice = await helper.findOne({ name: 'Alice' });
    console.log('Found:', alice);

    // Aggregation
    const stats = await users.aggregate([
        { type: '$group', params: { _id: '$role', count: { $sum: 1 } } },
    ]);
    console.log('Stats:', stats);

    // Paginate
    for await (const page of helper.paginate({ limit: 5 })) {
        console.log(`Page ${page.page}:`, page.data.length, 'docs');
    }

    db.close();
}

main().catch(console.error);
```

## License

MIT
