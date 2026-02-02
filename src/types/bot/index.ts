import {
    type ConfigRepository,
    type DrizzleDatabase,
    type UserRepository,
    users,
} from '@root/database';
import type { PlayerStatsRepository } from '@root/database/repositories/PlayerStatsRepository';
import type { EconomyService, UserService, RPGService, MessageService } from '@root/services';
import type { CommandService } from '@root/services/CommandService';
import type { NameStore } from '@root/stores';
import type { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { eq } from 'drizzle-orm';

export type BotContext = {
    socket: WASocket | null;
    database: DrizzleDatabase;
    prefix: string;
    services: {
        users: UserService;
        rpg: RPGService;
        economy: EconomyService;
        messages: MessageService;
        commands: CommandService;
    };
    stores: {
        names: NameStore;
    };
    repositories: {
        playerStats: PlayerStatsRepository;
        users: UserRepository;
        config: ConfigRepository;
    };
};

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
    aliases: string[] = [];

    abstract execute(ctx: CommandContext, bot: BotContext): Promise<void>;

    private static bareJid(jid: string | undefined): string {
        if (!jid) return '';
        const atIdx = jid.indexOf('@');
        if (atIdx === -1) return jid;
        const left = jid.slice(0, atIdx).split(':')[0];
        return left + jid.slice(atIdx);
    }

    private async toComparableJid(jid: string, bot: BotContext): Promise<string> {
        const bare = BaseCommand.bareJid(jid);
        if (!bare) return '';
        if (bare.includes('@lid')) {
            try {
                const pn = await bot.socket?.signalRepository?.lidMapping?.getPNForLID?.(jid);
                return pn ? BaseCommand.bareJid(pn) : bare;
            } catch {
                return bare;
            }
        }
        return bare;
    }

    async canExecute(
        ctx: CommandContext,
        bot: BotContext,
    ): Promise<{ ok: boolean; reason?: string }> {
        if (this.isAdminOnly || this.isBotAdminOnly) {
            const metadata = await bot.socket?.groupMetadata?.(ctx.groupId);
            const participants = metadata?.participants ?? [];
            const senderBare = await this.toComparableJid(ctx.sender, bot);

            if (this.isAdminOnly) {
                let isUserAdmin = false;
                for (const p of participants) {
                    const participantBare = p.phoneNumber
                        ? BaseCommand.bareJid(p.phoneNumber)
                        : await this.toComparableJid(p.id, bot);
                    if (
                        participantBare === senderBare &&
                        (p.admin === 'admin' || p.admin === 'superadmin')
                    ) {
                        isUserAdmin = true;
                        break;
                    }
                }
                if (!isUserAdmin) {
                    return { ok: false, reason: 'You must be a group admin to run this command.' };
                }
            }

            if (this.isBotAdminOnly) {
                const senderBare = await this.toComparableJid(ctx.sender, bot);

                const user = await bot.database
                    .select()
                    .from(users)
                    .where(eq(users.id, senderBare))
                    .get();

                if (!user?.isAdmin || !user?.isOwner) {
                    return { ok: false, reason: 'You must be a bot admin to run this command.' };
                }

                return { ok: true };
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
