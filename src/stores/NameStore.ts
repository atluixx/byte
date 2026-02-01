export class NameStore {
    private jidToName: Map<string, string> = new Map();
    private nameToJid: Map<string, string> = new Map();

    set(jid: string, name: string): void {
        const oldName = this.jidToName.get(jid);
        if (oldName) {
            this.nameToJid.delete(oldName.toLowerCase());
        }

        this.jidToName.set(jid, name);
        this.nameToJid.set(name.toLowerCase(), jid);
    }

    get(jid: string): string | undefined {
        return this.jidToName.get(jid);
    }

    getJIDByName(name: string): string | undefined {
        return this.nameToJid.get(name.toLowerCase());
    }

    has(jid: string): boolean {
        return this.jidToName.has(jid);
    }

    hasName(name: string): boolean {
        return this.nameToJid.has(name.toLowerCase());
    }

    delete(jid: string): boolean {
        const name = this.jidToName.get(jid);
        if (name) {
            this.nameToJid.delete(name.toLowerCase());
        }
        return this.jidToName.delete(jid);
    }

    deleteByName(name: string): boolean {
        const jid = this.nameToJid.get(name.toLowerCase());
        if (jid) {
            this.jidToName.delete(jid);
        }
        return this.nameToJid.delete(name.toLowerCase());
    }

    clear(): void {
        this.jidToName.clear();
        this.nameToJid.clear();
    }

    getAll(): Map<string, string> {
        return new Map(this.jidToName);
    }

    get size(): number {
        return this.jidToName.size;
    }

    toJSON(): Record<string, string> {
        return Object.fromEntries(this.jidToName);
    }

    fromJSON(data: Record<string, string>): void {
        this.clear();
        Object.entries(data).forEach(([jid, name]) => {
            this.set(jid, name);
        });
    }

    searchByName(query: string): Array<{ jid: string; name: string }> {
        const lowerQuery = query.toLowerCase();
        const results: Array<{ jid: string; name: string }> = [];

        for (const [jid, name] of this.jidToName) {
            if (name.toLowerCase().includes(lowerQuery)) {
                results.push({ jid, name });
            }
        }

        return results;
    }

    getAllNames(): string[] {
        return Array.from(this.jidToName.values());
    }

    getAllJIDs(): string[] {
        return Array.from(this.jidToName.keys());
    }
}
