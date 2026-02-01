import { type ConnectionState } from '@whiskeysockets/baileys';
import { logger } from './logger';
import qrcode from 'qrcode-terminal';
import { createSocket } from '..';
import fs from 'fs';
import { AUTH_DIR } from '@root/constants';

let reconnecting = false;

export function handleConnection(state: Partial<ConnectionState>) {
    const { qr, connection, lastDisconnect } = state;
    const authLogger = logger.child({ module: 'authentication' });

    if (qr) {
        qrcode.generate(qr, { small: true }, (text) => {
            authLogger.info(`QR code generated, scan to continue:\n${text}`);
        });
    }

    if (connection === 'open') {
        authLogger.info('Bot connected');
    }

    if (connection === 'close') {
        const reason = String(
            lastDisconnect?.error?.message ?? lastDisconnect?.error?.cause ?? 'unknown reason',
        ).toLowerCase();

        authLogger.warn(`Bot disconnected: ${reason}`);

        if (reconnecting) return;
        reconnecting = true;

        if (reason.includes('timed out') || reason.includes('restart')) {
            authLogger.info('Reconnecting in 3s...');
            setTimeout(() => {
                createSocket();
                reconnecting = false;
            }, 3000);
        } else if (
            reason.includes('failure') ||
            reason.includes('terminated') ||
            reason.includes('logged out')
        ) {
            authLogger.error('Logged out. Removing old auth...');
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            authLogger.info('Old auth removed. Recreating connection in 3s...');
            setTimeout(() => {
                createSocket();
                reconnecting = false;
            }, 3000);
        } else {
            authLogger.error('Unhandled disconnect reason. Bot will not reconnect automatically.');
            reconnecting = false;
        }
    }
}
