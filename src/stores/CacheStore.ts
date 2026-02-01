export class CacheStore {
    private cache: Map<string, any> = new Map();

    set(key: string, value: any): void {
        this.cache.set(key, value);
    }

    get(key: string): any | undefined {
        return this.cache.get(key);
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    keys(): IterableIterator<string> {
        return this.cache.keys();
    }

    values(): IterableIterator<any> {
        return this.cache.values();
    }

    entries(): IterableIterator<[string, any]> {
        return this.cache.entries();
    }

    get size(): number {
        return this.cache.size;
    }
}
