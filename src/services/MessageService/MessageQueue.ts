type QueueItem<T> = {
    data: T;
    resolve: () => void;
    reject: (err: any) => void;
};

export class MessageQueue<T> {
    private queue: QueueItem<T>[] = [];
    private running = false;

    constructor(private handler: (item: T) => Promise<void>) {}

    async enqueue(item: T) {
        return new Promise<void>((resolve, reject) => {
            this.queue.push({ data: item, resolve, reject });
            this.run();
        });
    }

    private async run() {
        if (this.running) return;
        this.running = true;

        while (this.queue.length > 0) {
            const { data, resolve, reject } = this.queue.shift()!;
            try {
                await this.handler(data);
                resolve();
            } catch (err) {
                reject(err);
            }
        }

        this.running = false;
    }
}
