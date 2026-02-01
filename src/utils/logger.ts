import pino from 'pino';

const ts = () => {
    const d = new Date();
    return `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}]`;
};

export const logger = pino({
    base: {},
    timestamp: false,
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: false } },
    hooks: {
        logMethod(args, method) {
            const label = (this as any)._label ?? 'main';

            const msg = args
                .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
                .join(' ');

            if (msg.includes('[bun]')) return;

            method.call(this, `:: ${ts()} ${label} ➔ ${msg}`);
        },
    },
});
