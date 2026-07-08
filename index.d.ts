export interface NekoDBCacheOptions {
    ttl?: number;
    maxSize?: number;
}

export interface NekoDBConfig {
    host: string;
    username?: string;
    password?: string;
    cache?: NekoDBCacheOptions;
    logging?: 'none' | 'debug' | 'info' | 'warn' | 'error';
}

export interface VectorSearchOptions {
    field: string;
    vector: number[];
    metric?: 'cosine' | 'euclidean';
    topK?: number;
}

export interface FtsSearchOptions {
    field: string;
    query: string;
    limit?: number;
}

export interface PaginationOptions {
    limit?: number;
    offset?: number;
    page?: number;
    cursor?: string;
    sort?: string[];
    filter?: object;
}

export interface SearchPaginationOptions {
    limit?: number;
    offset?: number;
    page?: number;
}

export interface BulkExecuteOptions {
    stopOnError?: boolean;
}

export class Collection {
    constructor(db: NekoDB, name: string);
    readonly name: string;

    insert(document: object): Promise<string>;
    get(id: string): Promise<any>;
    list(): Promise<any[]>;
    search(query: object): Promise<any[]>;
    vectorSearch(options: VectorSearchOptions): Promise<any[]>;
    ftsSearch(options: FtsSearchOptions): Promise<any[]>;
    update(id: string, data: object): Promise<string>;
    delete(id: string): Promise<string>;
    count(): Promise<number>;
    drop(): Promise<string>;
    listPaginated(options?: PaginationOptions): Promise<any>;
    searchPaginated(query: object, options?: SearchPaginationOptions): Promise<any>;
    aggregate(stages: object[]): Promise<any[]>;
    bulkInsert(documents: object[]): Promise<any>;
    bulkUpdate(updates: Record<string, object>): Promise<any>;
    bulkDelete(ids: string[]): Promise<any>;
    getProjected(id: string, projection: object): Promise<any>;
    searchProjected(query: object, projection: object): Promise<any[]>;
    createIndex(field: string, type?: 'hash' | 'sorted'): Promise<any>;
    listIndexes(): Promise<any[]>;
    queueInsert(data: object): void;
    queueUpdate(id: string, data: object): void;
    queueDelete(id: string): void;
    exportCSV(docId: string): Promise<any>;
    exportJSON(docId: string): Promise<any>;
    query(): QueryBuilder;
    helper(): CollectionHelper;
}

export class NekoDB {
    constructor(config: NekoDBConfig);
    readonly connected: boolean;
    readonly ready: Promise<boolean>;

    insert(collection: string, data: object, transactionId?: string): Promise<string>;
    get(collection: string, id: string): Promise<any>;
    list(collection: string): Promise<any[]>;
    search(collection: string, query: object): Promise<any[]>;
    vectorSearch(collection: string, options: VectorSearchOptions): Promise<any[]>;
    ftsSearch(collection: string, options: FtsSearchOptions): Promise<any[]>;
    update(collection: string, id: string, data: object, transactionId?: string): Promise<string>;
    delete(collection: string, id: string, transactionId?: string): Promise<string>;
    count(collection: string): Promise<number>;
    listCollections(): Promise<string[]>;
    deleteCollection(collection: string): Promise<string>;
    listPaginated(collection: string, options?: PaginationOptions): Promise<any>;
    searchPaginated(collection: string, query: object, options?: SearchPaginationOptions): Promise<any>;
    aggregate(collection: string, stages: object[]): Promise<any[]>;
    bulkExecute(operations: object[], options?: BulkExecuteOptions): Promise<any>;
    bulkInsert(collection: string, documents: object[]): Promise<any>;
    bulkUpdate(collection: string, updates: Record<string, object>): Promise<any>;
    bulkDelete(collection: string, documentIds: string[]): Promise<any>;
    getProjected(collection: string, id: string, projection: object): Promise<any>;
    searchProjected(collection: string, query: object, projection: object): Promise<any[]>;
    createIndex(collection: string, field: string, type?: 'hash' | 'sorted'): Promise<any>;
    listIndexes(collection: string): Promise<any[]>;
    registerSchema(collection: string, schemaConfig: object): Promise<any>;
    createSnapshot(): Promise<any>;
    restoreSnapshot(filename: string): Promise<any>;
    subscribe(collection: string, handler: (event: any) => void): Promise<any>;
    beginTransaction(): Promise<string>;
    commitTransaction(transactionId: string): Promise<any>;
    rollbackTransaction(transactionId: string): Promise<any>;
    queueInsert(collection: string, data: object): void;
    queueUpdate(collection: string, id: string, data: object): void;
    queueDelete(collection: string, id: string): void;
    flushQueue(): Promise<void>;
    clearCache(): void;
    exportCSV(collection: string, docId: string): Promise<any>;
    exportJSON(collection: string, docId: string): Promise<any>;
    downloadExport(filename: string, outputPath: string): Promise<string>;
    collection(name: string): Collection;
    helper(name: string): CollectionHelper;
    query(collection: string): QueryBuilder;
    close(): void;
    on(event: string, handler: (data: any) => void): this;

    static fromEnv(host?: string): NekoDB;
}

export class AuthManager {
    constructor(username?: string, password?: string);
    getCredentials(): { username?: string; password?: string };
}

export class QueryBuilder {
    constructor(db: NekoDB, collection: string);
    where(query: object): this;
    limit(val: number): this;
    offset(val: number): this;
    sort(fields: string[]): this;
    project(projection: object): this;
    exec(): Promise<any>;
}

export class Schema {
    constructor(config: object);
    validate(doc: object): { valid: boolean; errors?: string[] };
}

export class EventBus {
    constructor();
    on(event: string, handler: Function): void;
    emit(event: string, data: any): void;
}

export class CollectionHelper {
    constructor(db: NekoDB, collection: string);
    find(query?: object): Promise<any[]>;
    findOne(query: object): Promise<any | null>;
    findById(id: string): Promise<any | null>;
    insert(doc: object): Promise<string>;
    update(query: object, data: object): Promise<any>;
    updateById(id: string, data: object): Promise<string>;
    delete(query: object): Promise<any>;
    deleteById(id: string): Promise<string>;
    count(query?: object): Promise<number>;
    upsert(query: object, data: object): Promise<any>;
}

export class ConnectionManager {
    constructor(host: string);
    connect(): Promise<any>;
    disconnect(): void;
}

export const errors: {
    NekoDBError: typeof Error;
    ConnectionError: typeof Error;
    AuthenticationError: typeof Error;
    ValidationError: typeof Error;
    NotFoundError: typeof Error;
};

export default NekoDB;
