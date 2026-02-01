import { BaseCommand, type CommandContext } from '@root/types';
import type { BotContext } from '@root/core';

export class SetPrefixCommand extends BaseCommand {
    override name = 'setprefix';
    override category = 'admin';
    override description = 'Changes the prefix used in this group';
    override argsLength = 1;
    override isAdminOnly = true;

    async execute(ctx: CommandContext, bot: BotContext): Promise<void> {
        const newPrefix = ctx.args[0];

        if (!newPrefix) {
            return;
        }

        await bot.repositories.config.setField(ctx.groupId, 'prefix', newPrefix);

        await bot.socket?.sendMessage(ctx.groupId, {
            text: `Prefix updated to: ${newPrefix}`,
        });
    }
}
