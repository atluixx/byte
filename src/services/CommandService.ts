import type { BotContext } from '@root/core';

export class CommandService {
    context!: BotContext;

    init(context: BotContext) {
        this.context = context;
    }
}
