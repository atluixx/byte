import type { BotContext } from '@root/core';
import type { WAMessage } from '@whiskeysockets/baileys';

export type CommandContext = {
    groupId: string;
    sender: string;
    senderName: string;
    text: string;
    args: string[];
    message: WAMessage;
};

export abstract class BaseCommand {
    abstract name: string;
    abstract category: string;

    description: string = 'No description provided';
    argsLength: number = 0;
    isAdminOnly: boolean = false;
    isBotAdminOnly: boolean = false;

    abstract execute(ctx: CommandContext, bot: BotContext): Promise<void>;

    private normalizeJid(jid: string | undefined): string {
        return jid?.split(':')[0] ?? '';
    }

    async canExecute(
        ctx: CommandContext,
        bot: BotContext,
    ): Promise<{ ok: boolean; reason?: string }> {
        if (this.isAdminOnly || this.isBotAdminOnly) {
            const metadata = await bot.socket?.groupMetadata?.(ctx.groupId);
            const participants = metadata?.participants ?? [];

            if (this.isAdminOnly) {
                const isUserAdmin = participants.some(
                    (p) =>
                        this.normalizeJid(p.id) === this.normalizeJid(ctx.sender) &&
                        (p.admin === 'admin' || p.admin === 'superadmin'),
                );
                if (!isUserAdmin) {
                    return { ok: false, reason: 'You must be a group admin to run this command.' };
                }
            }

            if (this.isBotAdminOnly) {
                const botId = this.normalizeJid(bot.socket?.user?.id);
                const isBotAdmin = participants.some(
                    (p) =>
                        this.normalizeJid(p.id) === botId &&
                        (p.admin === 'admin' || p.admin === 'superadmin'),
                );
                if (!isBotAdmin) {
                    return { ok: false, reason: 'I need to be an admin to run this command.' };
                }
            }
        }

        if (ctx.args.length < this.argsLength) {
            return {
                ok: false,
                reason: `Not enough arguments. This command requires at least ${this.argsLength} argument(s).`,
            };
        }

        return { ok: true };
    }
}
