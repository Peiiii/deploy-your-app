/**
 * SSE (Server-Sent Events) parsing utilities.
 */

export interface ParsedSseEvents {
    events: string[];
    rest: string;
}

/**
 * Extract complete SSE events from a buffer.
 * Events are separated by double newlines. Each event starts with "data: ".
 */
export function extractSseEvents(buffer: string): ParsedSseEvents {
    const events: string[] = [];
    let rest = buffer;
    let splitIndex: number;

    while ((splitIndex = rest.indexOf('\n\n')) !== -1) {
        const chunk = rest.slice(0, splitIndex);
        rest = rest.slice(splitIndex + 2);
        const line = chunk.split('\n').find((l) => l.trim().startsWith('data:'));
        if (line) {
            events.push(line.replace(/^data:\s*/, ''));
        }
    }

    return { events, rest };
}
