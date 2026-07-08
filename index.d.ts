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
    get<T = any>(id: string): Promise<T>;
    list<T = any>(): Promise<T[]>;
    search<T = any>(query: object): Promise<T[]>;
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
    watch<T = any>(query: object, callback: (docs: T[]) => void): { close(): void };
}

export class NekoDB {
    constructor(config: NekoDBConfig);
    readonly connected: boolean;
    readonly ready: Promise<boolean>;

    insert(collection: string, data: object, transactionId?: string): Promise<string>;
    get<T = any>(collection: string, id: string): Promise<T>;
    list<T = any>(collection: string): Promise<T[]>;
    search<T = any>(collection: string, query: object): Promise<T[]>;
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
    watch<T = any>(
        collection: string,
        query: object,
        callback: (docs: T[]) => void,
        options?: {
            sort?: { field: string; order?: 'asc' | 'desc' }[];
            limit?: number;
            projection?: object;
        }
    ): { close(): void };
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
    where(field: string): FieldQuery;
    eq(field: string, value: any): this;
    gt(field: string, value: any): this;
    gte(field: string, value: any): this;
    lt(field: string, value: any): this;
    lte(field: string, value: any): this;
    ne(field: string, value: any): this;
    in(field: string, values: any[]): this;
    nin(field: string, values: any[]): this;
    between(field: string, min: any, max: any): this;
    regex(field: string, pattern: string): this;
    select(...fields: string[]): this;
    exclude(...fields: string[]): this;
    sort(field: string, order?: 'asc' | 'desc'): this;
    sortAsc(field: string): this;
    sortDesc(field: string): this;
    limit(val: number): this;
    offset(val: number): this;
    page(val: number): this;
    cursor(c: string): this;
    exec<T = any>(): Promise<T>;
    count(): Promise<number>;
    first<T = any>(): Promise<T | null>;
    watch<T = any>(callback: (docs: T[]) => void): { close(): void };
}

export class FieldQuery {
    constructor(builder: QueryBuilder, field: string);
    eq(value: any): QueryBuilder;
    gt(value: any): QueryBuilder;
    gte(value: any): QueryBuilder;
    lt(value: any): QueryBuilder;
    lte(value: any): QueryBuilder;
    ne(value: any): QueryBuilder;
    in(values: any[]): QueryBuilder;
    nin(values: any[]): QueryBuilder;
    between(min: any, max: any): QueryBuilder;
    regex(pattern: string): QueryBuilder;
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
    find<T = any>(query?: object): Promise<T[]>;
    findOne<T = any>(query: object): Promise<T | null>;
    findById<T = any>(id: string): Promise<T | null>;
    insert(doc: object): Promise<string>;
    update(query: object, data: object): Promise<any>;
    updateById(id: string, data: object): Promise<string>;
    delete(query: object): Promise<any>;
    deleteById(id: string): Promise<string>;
    count(query?: object): Promise<number>;
    upsert(query: object, data: object): Promise<any>;
    updatePath(id: string, path: string, value: any): Promise<string>;
    pushToArray(id: string, path: string, value: any): Promise<string>;
    pullFromArray(id: string, path: string, value: any): Promise<string>;
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
