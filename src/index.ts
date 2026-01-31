import { AUTH_DIR } from '@root/constants';
import { handleConnection, logger } from '@root/utils';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import fs from 'node:fs';
import { pino } from 'pino';

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

export const socket = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
});

socket.ev.on('creds.update', saveCreds);
socket.ev.on('connection.update', (state) => handleConnection(state));

console['log'] = () => {};
console['warn'] = () => {};
console['error'] = () => {};
console['info'] = () => {};
