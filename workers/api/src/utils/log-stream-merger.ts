/**
 * Utility for merging SSE streams from Node deployment server
 * with Worker-side log events.
 */

export type LogLevel = 'info' | 'warning' | 'error' | 'success';
export type LogSource = 'node' | 'worker';

export interface SSELogEvent {
    type: 'log';
    message: string;
    level: LogLevel;
    source?: LogSource;
}

export interface SSEStatusEvent {
    type: 'status';
    status: string;
    [key: string]: unknown;
}

export type SSEEvent = SSELogEvent | SSEStatusEvent;

/**
 * Merges SSE streams from Node server with Worker-injected log events.
 * 
 * Strategy:
 * 1. Read chunks from Node's SSE stream
 * 2. Before forwarding each chunk, flush any pending Worker logs
 * 3. Forward the Node chunk
 * 4. Handle stream completion and errors
 */
export class LogStreamMerger {
    private encoder = new TextEncoder();
    private decoder = new TextDecoder();
    private nodeReader: ReadableStreamDefaultReader<Uint8Array>;
    private workerQueue: SSEEvent[] = [];
    private outputController: ReadableStreamDefaultController<Uint8Array> | null = null;
    private closed = false;

    constructor(nodeStream: ReadableStream<Uint8Array>) {
        this.nodeReader = nodeStream.getReader();
    }

    /**
     * Inject a log event from Worker into the stream.
     * Logs are queued and flushed before the next Node chunk.
     */
    injectLog(message: string, level: LogLevel = 'info'): void {
        if (this.closed) return;

        this.workerQueue.push({
            type: 'log',
            message,
            level,
            source: 'worker',
        });

        // If stream is actively being read, try to flush immediately
        this.tryFlushQueue();
    }

    /**
     * Create the output stream that merges Node and Worker events.
     */
    getOutputStream(): ReadableStream<Uint8Array> {
        return new ReadableStream<Uint8Array>({
            start: (controller) => {
                this.outputController = controller;
            },
            pull: async (controller) => {
                try {
                    // First, flush any pending Worker logs
                    this.flushQueueToController(controller);

                    // Then read from Node stream
                    const { done, value } = await this.nodeReader.read();

                    if (done) {
                        // Flush any remaining Worker logs before closing
                        this.flushQueueToController(controller);
                        controller.close();
                        this.closed = true;
                        return;
                    }

                    // Forward Node chunk to output
                    controller.enqueue(value);
                } catch (err) {
                    console.error('[LogStreamMerger] Stream error:', err);
                    controller.error(err);
                    this.closed = true;
                }
            },
            cancel: async () => {
                this.closed = true;
                try {
                    await this.nodeReader.cancel();
                } catch {
                    // Ignore cancellation errors
                }
            },
        });
    }

    /**
     * Try to flush Worker logs if controller is available.
     */
    private tryFlushQueue(): void {
        if (this.outputController && this.workerQueue.length > 0) {
            this.flushQueueToController(this.outputController);
        }
    }

    /**
     * Flush all queued Worker events to the output stream.
     */
    private flushQueueToController(controller: ReadableStreamDefaultController<Uint8Array>): void {
        while (this.workerQueue.length > 0) {
            const event = this.workerQueue.shift()!;
            const sseData = this.formatSSE(event);
            const encoded = this.encoder.encode(sseData);
            controller.enqueue(encoded);
        }
    }

    /**
     * Format an event as SSE data.
     */
    private formatSSE(event: SSEEvent): string {
        const json = JSON.stringify(event);
        return `data: ${json}\n\n`;
    }
}
