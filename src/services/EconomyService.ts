import type { BotContext } from '@root/core';

export class EconomyService {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }
}
