import fs from 'fs';
import path from 'path';
import type { BotContext } from '@root/core';
import type { WAMessage } from '@whiskeysockets/baileys';
import { BaseCommand, type CommandContext } from '@root/types/bot';
import { COMMANDS_FOLDER } from '@root/constants';

export class CommandService {
    private context!: BotContext;
    private commands: Map<string, BaseCommand> = new Map();

    init(context: BotContext) {
        this.context = context;
        this.loadCommands(COMMANDS_FOLDER);
        console.log(`Loaded ${this.commands.size} commands`);
    }

    private loadCommands(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                this.loadCommands(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                const commandModule = require(fullPath);
                const exportedClasses = Object.values(commandModule).filter(
                    (v): v is { new (): BaseCommand } =>
                        typeof v === 'function' &&
                        !Object.getPrototypeOf(v).hasOwnProperty('prototype') === false,
                );

                for (const CommandClass of exportedClasses) {
                    try {
                        const commandInstance = new CommandClass();
                        const nameKey = commandInstance.name.toLowerCase();
                        this.commands.set(nameKey, commandInstance);
                        for (const alias of commandInstance.aliases ?? []) {
                            this.commands.set(alias.toLowerCase(), commandInstance);
                        }
                    } catch (err) {
                        console.warn(`Failed to instantiate command from ${fullPath}:`, err);
                    }
                }
            }
        }
    }

    async execute(ctx: {
        groupId: string;
        sender: string;
        senderName: string;
        text: string;
        originalText: string;
        message: WAMessage;
    }) {
        const { groupId, sender, senderName, text, message } = ctx;
        if (!text) return;

        const [rawCommand, ...args] = text.trim().split(/\s+/);
        const commandName = rawCommand?.toLowerCase();
        if (!commandName) return;

        const command = this.commands.get(commandName);
        if (!command) {
            console.log(`Unknown command: ${commandName}`);
            return;
        }

        const commandCtx: CommandContext = {
            groupId,
            sender,
            senderName,
            text,
            args,
            message,
        };

        const { ok, reason } = await command.canExecute(commandCtx, this.context);
        if (!ok) {
            if (reason) {
                await this.context.socket?.sendMessage(groupId, { text: `❌ ${reason}` });
            }
            return;
        }

        try {
            await command.execute(commandCtx, this.context);
        } catch (err) {
            console.error(`Error executing command ${commandName}:`, err);
            await this.context.socket?.sendMessage(groupId, {
                text: `❌ Failed to execute command: ${commandName}`,
            });
        }
    }
}
