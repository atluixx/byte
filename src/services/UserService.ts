import type { BotContext } from '@root/core';

export class UserService {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }

    async find(query: string) {}
}
