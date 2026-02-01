import fs from 'fs';
import path from 'path';
import type { BotContext } from '@root/core';
import { logger } from '@root/utils';
import type { MessageUpsertType, WAMessage, WAMessageContent } from '@whiskeysockets/baileys';
import { MessageQueue } from '@root/services';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { LOG_DIR, TEMP_DIR } from '@root/constants';
import { ConfigRepository } from '@root/database';

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
    }

    enqueue(ctx: MessageContext) {
        return this.queue.enqueue(ctx);
    }

    private async resolveSender(jid: string | undefined) {
        if (!jid) return 'unknown';
        if (jid.includes('@s.whatsapp.net')) return jid;

        if (jid.includes('@lid')) {
            try {
                const phoneNumber =
                    await this.context.socket?.signalRepository.lidMapping?.getPNForLID?.(jid);
                return phoneNumber || jid;
            } catch (err) {
                logger.error({ jid, err }, 'Failed to resolve LID');
                return jid;
            }
        }

        return jid;
    }

    private async processMessage({ messages, type }: MessageContext) {
        if (type !== 'notify') return;

        for (const m of messages) {
            const from = m.key.remoteJid;
            const senderJid = m.key.participant || m.key.remoteJidAlt || from;
            const sender = await this.resolveSender(senderJid!);

            // --- stores logic ---
            let senderName = m.pushName || this.context.stores?.names?.get(sender) || sender;
            if (m.pushName && sender) {
                this.context.stores?.names?.set(sender, m.pushName);
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
                    text = this.extractText(protocolMsg.editedMessage as any);
                }
            } else {
                text = this.extractText(m.message!);
            }

            const timestamp = this.formatTimestamp(now);
            fs.appendFileSync(
                path.join(LOG_DIR, this.getLogFileName(now)),
                `${timestamp} ${senderName} (${sender}) ${action} a message: ${text ?? '[media / unknown]'}\n`,
            );

            if (action === 'sent') await this.saveMedia(m.message!);

            logger.info({ from, sender, senderName, text, action });

            if (from?.endsWith('@g.us') && text) {
                const groupId = from;
                const config = await this.context.repositories.config.getConfig(groupId);
                const prefix = config?.prefix ?? '!';

                if (text.startsWith(prefix)) {
                    const commandBody = text.slice(prefix.length).trim();
                    await this.context.services.commands.execute({
                        groupId,
                        sender,
                        senderName,
                        text: commandBody,
                        originalText: text,
                        message: m,
                    });
                }
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

    private async saveMedia(message: WAMessageContent | undefined) {
        if (!message) return;

        const mediaType = Object.keys(message).find((k) => k.endsWith('Message')) as
            | keyof WAMessageContent
            | undefined;
        if (!mediaType) return;

        const media = (message as any)[mediaType];
        if (!media?.url) return;

        try {
            const buffer = await downloadMediaMessage(media, 'buffer', {});
            const ext = this.getExtension(mediaType);
            const fileName = path.join(
                TEMP_DIR,
                `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`,
            );
            fs.writeFileSync(fileName, buffer);
            logger.info(`Media saved: ${fileName}`);
        } catch (err) {
            logger.error(err, 'Failed to save media');
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
}
