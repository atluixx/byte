import fs from 'fs';
import path from 'path';
import type { BotContext } from '@root/core';
import { logger } from '@root/utils';
import type { MessageUpsertType, WAMessage, WAMessageContent } from '@whiskeysockets/baileys';
import { MessageQueue } from '@root/services';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { LOG_DIR, TEMP_DIR } from '@root/constants';

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

type MessageContext = {
    messages: WAMessage[];
    type: MessageUpsertType;
    requestId?: string;
};

export class MessageService {
    context!: BotContext;
    private queue!: MessageQueue<MessageContext>;

    init(context: BotContext) {
        this.context = context;
        this.queue = new MessageQueue(async (ctx) => this.processMessage(ctx));
        this.cleanupNameStore();
    }

    enqueue(ctx: MessageContext) {
        return this.queue.enqueue(ctx);
    }

    private async resolveSender(jid: string | undefined): Promise<string> {
        if (!jid) return 'unknown';

        let cleanJid = jid.replace(/:0$/, '');

        if (cleanJid.includes('@s.whatsapp.net')) return cleanJid;

        if (cleanJid.includes('@lid')) {
            try {
                const phoneNumber =
                    await this.context.socket?.signalRepository.lidMapping?.getPNForLID?.(cleanJid);

                return phoneNumber ? phoneNumber.replace(/:0$/, '') : cleanJid;
            } catch (err) {
                logger.error({ jid: cleanJid, err }, 'Failed to resolve LID');
                return cleanJid;
            }
        }

        return cleanJid;
    }

    private async ensureUserExists(userId: string, userName: string): Promise<void> {
        try {
            await this.context.repositories.users.upsert({
                id: userId,
                name: userName,
                lastActive: Math.floor(Date.now() / 1000),
            });

            await this.context.repositories.playerStats.upsert({
                userId: userId,
                level: 1,
                xp: 0,
                hp: 100,
                mp: 50,
                coins: 0,
                bank: 0,
                bankInterest: 15,
                class: 'warrior',
                strength: 10,
                defense: 10,
                agility: 10,
                magic: 10,
                battlesWon: 0,
                battlesLost: 0,
                questsCompleted: 0,
                itemsCollected: 0,
                lastActive: Math.floor(Date.now() / 1000),
            });

            logger.debug({ userId, userName }, 'User ensured in database');
        } catch (err) {
            logger.error({ err, userId, userName }, 'Failed to ensure user exists');
        }
    }

    private async processMessage({ messages, type }: MessageContext): Promise<void> {
        if (type !== 'notify') return;

        for (const m of messages) {
            try {
                const from = m.key.remoteJid;
                if (!from) {
                    logger.warn('Message without remoteJid, skipping');
                    continue;
                }

                const senderJid = m.key.participant || m.key.remoteJidAlt || from;
                const sender = await this.resolveSender(senderJid);

                const cleanSender = sender.replace(/:0$/, '');

                let senderName =
                    m.pushName ||
                    this.context.stores?.names?.get(cleanSender) ||
                    cleanSender ||
                    'Unknown';

                if (m.pushName && cleanSender) {
                    this.context.stores?.names?.set(cleanSender, m.pushName);
                }

                if (from.endsWith('@g.us') && cleanSender !== 'unknown') {
                    await this.ensureUserExists(cleanSender, senderName);
                }

                const now = new Date();
                let action = 'sent';
                let text: string | null = null;

                if (m.message?.protocolMessage) {
                    const protocolMsg = m.message.protocolMessage;
                    if (protocolMsg.type === 0) {
                        action = 'deleted';
                    } else if (protocolMsg.type === 14 && protocolMsg.editedMessage) {
                        action = 'edited';
                        text = this.extractText(protocolMsg.editedMessage as WAMessageContent);
                    }
                } else {
                    text = this.extractText(m.message!);
                }

                const timestamp = this.formatTimestamp(now);
                const logMessage = `${timestamp} ${senderName} (${cleanSender}) ${action} a message: ${text ?? '[media / unknown]'}\n`;

                try {
                    fs.appendFileSync(path.join(LOG_DIR, this.getLogFileName(now)), logMessage);
                } catch (err) {
                    logger.error({ err }, 'Failed to write to log file');
                }

                if (action === 'sent' && m.message) {
                    await this.saveMedia(m.message);
                }

                logger.info({ from, sender: cleanSender, senderName, text, action });

                if (from.endsWith('@g.us') && text && action === 'sent') {
                    const groupId = from;

                    try {
                        const config = await this.context.repositories.config.getConfig(groupId);
                        const prefix = config?.prefix ?? '!';

                        if (text.startsWith(prefix)) {
                            const commandBody = text.slice(prefix.length).trim();

                            if (commandBody) {
                                await this.context.services.commands.execute({
                                    groupId,
                                    sender: cleanSender,
                                    senderName,
                                    text: commandBody,
                                    originalText: text,
                                    message: m,
                                });
                            }
                        }
                    } catch (err) {
                        logger.error({ err, groupId }, 'Failed to process command');
                    }
                }
            } catch (err) {
                logger.error({ err, messageKey: m.key }, 'Failed to process message');
            }
        }
    }

    private formatTimestamp(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `[${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date
            .getFullYear()
            .toString()
            .slice(2)} ${pad(date.getHours())}:${pad(date.getMinutes())}]`;
    }

    private getLogFileName(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.log`;
    }

    private extractText(message: WAMessageContent | undefined): string | null {
        if (!message) return null;

        if ('conversation' in message && message.conversation) return message.conversation;
        if ('extendedTextMessage' in message && message.extendedTextMessage?.text)
            return message.extendedTextMessage.text;
        if ('imageMessage' in message && message.imageMessage?.caption)
            return message.imageMessage.caption;
        if ('videoMessage' in message && message.videoMessage?.caption)
            return message.videoMessage.caption;
        if ('documentMessage' in message && message.documentMessage?.fileName)
            return message.documentMessage.fileName;
        if ('stickerMessage' in message) return '[sticker]';

        return null;
    }

    private async saveMedia(message: WAMessageContent | undefined): Promise<void> {
        if (!message) return;

        const mediaType = Object.keys(message).find((k) => k.endsWith('Message')) as
            | keyof WAMessageContent
            | undefined;

        if (!mediaType) return;

        const media = (message as any)[mediaType];
        if (!media?.url) return;

        try {
            const buffer = await downloadMediaMessage(
                { key: {}, message } as WAMessage,
                'buffer',
                {},
            );

            if (!buffer || buffer.length === 0) {
                logger.warn('Downloaded media buffer is empty');
                return;
            }

            const ext = this.getExtension(mediaType);
            const fileName = path.join(
                TEMP_DIR,
                `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`,
            );

            fs.writeFileSync(fileName, buffer);
            logger.info({ fileName, size: buffer.length }, 'Media saved');
        } catch (err) {
            logger.error({ err, mediaType }, 'Failed to save media');
        }
    }

    private getExtension(type: string): string {
        const extensions: Record<string, string> = {
            imageMessage: 'jpg',
            videoMessage: 'mp4',
            audioMessage: 'mp3',
            documentMessage: 'bin',
            stickerMessage: 'webp',
        };
        return extensions[type] ?? 'dat';
    }

    private cleanupNameStore() {
        if (!this.context.stores?.names) return;

        const entries = Array.from(this.context.stores.names.getAll().entries());

        for (const [key, value] of entries) {
            if (key.includes(':0@')) {
                const cleanKey = key.replace(/:0@/, '@');
                this.context.stores.names.delete(key);
                this.context.stores.names.set(cleanKey, value);
                logger.info({ oldKey: key, newKey: cleanKey }, 'Cleaned name store entry');
            }
        }
    }
}
