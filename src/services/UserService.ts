import type { BotContext } from '@root/core';

export class UserService {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    async find(query: string) {
        const trimmed = query.trim();
        if (!trimmed) return null;
        if (/^\d+$/.test(trimmed.replace(/\D/g, ''))) {
            return this.context.repositories.users.findByPhone(trimmed);
        }
        if (trimmed.includes('@')) {
            return this.context.repositories.users.findByJID(trimmed);
        }
        return this.context.repositories.users.findByName(trimmed);
    }
}
