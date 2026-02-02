import { playerStats, users } from '@root/database';
import { BaseCommand, type BotContext, type CommandContext } from '@root/types';
import { eq } from 'drizzle-orm';

export class BalanceCommand extends BaseCommand {
    override name = 'balance';
    override category = 'economy';
    override description = 'Allows you to know your or others current amount of coins';
    override argsLength = 0;
    override aliases = ['bal', 'dinheiro', 'coins'];

    override async execute(ctx: CommandContext, bot: BotContext): Promise<void> {
        if (!ctx.sender) {
            bot.socket?.sendMessage(ctx.groupId, {
                text: 'Error: Unable to identify user.',
            });
            return;
        }

        if (!ctx.groupId) {
            console.error('Error: Missing groupId in context');
            return;
        }

        try {
            let targetUserId = ctx.sender;
            let targetName = 'You';

            const mentionedJidList =
                ctx.message.message?.extendedTextMessage?.contextInfo?.mentionedJid;

            if (mentionedJidList && mentionedJidList.length > 0) {
                targetUserId = (await bot.socket?.signalRepository.lidMapping.getPNForLID(
                    mentionedJidList?.[0]!,
                ))!;
                targetUserId = targetUserId.replace(/:0$/, '')!;

                const storedName = bot.stores?.names?.get(targetUserId);

                if (storedName) {
                    targetName = storedName;
                } else {
                    const mentionedUser = await bot.database
                        .select()
                        .from(users)
                        .where(eq(users.id, targetUserId))
                        .get();

                    targetName = mentionedUser?.name ?? 'User';
                }
            }

            const userStatus = await bot.database
                .select()
                .from(playerStats)
                .where(eq(playerStats.userId, targetUserId))
                .get();

            const bank = userStatus?.bank ?? 0;
            const gold = userStatus?.coins ?? 0;
            const total = bank + gold;

            if (!bot.socket) {
                console.error('Error: Socket not available');
                return;
            }

            const message =
                targetUserId === ctx.sender
                    ? `You have ${gold} coins and ${bank} coins in the bank.\nYour total is ${total} coins`
                    : `${targetName} has ${gold} coins and ${bank} coins in the bank.\nTheir total is ${total} coins`;

            bot.socket.sendMessage(ctx.groupId, {
                text: message,
            });
        } catch (error) {
            console.error('Error fetching balance:', error);

            bot.socket?.sendMessage(ctx.groupId, {
                text: 'An error occurred while fetching the balance. Please try again later.',
            });
        }
    }
}
