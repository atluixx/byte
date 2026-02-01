import type { BotContext } from '@root/core';

export class RPGService {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }
}
