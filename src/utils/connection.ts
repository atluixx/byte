import { DisconnectReason, type ConnectionState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { logger } from '.';

export function handleConnection(state: Partial<ConnectionState>) {
    const { qr, connection, lastDisconnect } = state;

    const authenticationLogger = logger.child({});
    (authenticationLogger as any)._label = 'authentication';

    if (qr) {
        qrcode.generate(qr, { small: true }, (code) => {
            authenticationLogger.info('generating qrcode...');

            setTimeout(() => {
                authenticationLogger.info(`qrcode generated for authentication: \n ${code}`);
            }, 3000);
        });
    }

    if (connection === 'open') {
        authenticationLogger.info('connection opened');
    }

    if (connection === 'close') {
        const reason =
            lastDisconnect?.error?.message ?? lastDisconnect?.error?.cause ?? 'unknown reason';
        authenticationLogger.warn(`connection closed: ${reason}`);
    }
}
