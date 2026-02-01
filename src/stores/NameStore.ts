export class NameStore {
    private names: Map<string, string> = new Map();

    set(jid: string, name: string): void {
        this.names.set(jid, name);
    }

    get(jid: string): string | undefined {
        return this.names.get(jid);
    }

    has(jid: string): boolean {
        return this.names.has(jid);
    }

    delete(jid: string): boolean {
        return this.names.delete(jid);
    }

    clear(): void {
        this.names.clear();
    }

    getAll(): Map<string, string> {
        return new Map(this.names);
    }

    get size(): number {
        return this.names.size;
    }

    // Export names as JSON
    toJSON(): Record<string, string> {
        return Object.fromEntries(this.names);
    }

    // Import names from JSON
    fromJSON(data: Record<string, string>): void {
        this.names.clear();
        Object.entries(data).forEach(([jid, name]) => {
            this.names.set(jid, name);
        });
    }
}
