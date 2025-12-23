/**
 * OpenAI API adapter for the Agent Alchemist.
 * Handles stream parsing and message serialization.
 */

import type { ToolDefinition, ToolInvocation, UIMessage } from '@agent-labs/agent-chat';
import type { OpenAIChatChunk } from '@agent-labs/agent-toolkit';

// ============================================================================
// Types
// ============================================================================

type OpenAIToolCall = {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
};

export type OpenAIMessage =
    | { role: 'system' | 'user' | 'assistant'; content: string; tool_calls?: OpenAIToolCall[] }
    | { role: 'tool'; content: string; tool_call_id: string };

// ============================================================================
// Stream Parsing
// ============================================================================

const decoder = new TextDecoder();

/**
 * Parse an SSE stream from OpenAI-compatible API into chunks.
 */
export async function* parseOpenAIStream(response: Response): AsyncGenerator<OpenAIChatChunk> {
    if (!response.body) {
        throw new Error('No response body returned from the AI gateway.');
    }

    const reader = response.body.getReader();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;

            try {
                const parsed = JSON.parse(payload) as OpenAIChatChunk;
                yield parsed;
            } catch (err) {
                console.warn('[Agent] Failed to parse stream chunk', err);
            }
        }

        if (done) {
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer.replace(/^data:\s*/, '')) as OpenAIChatChunk;
                    yield parsed;
                } catch {
                    // Ignore trailing noise.
                }
            }
            break;
        }
    }
}

// ============================================================================
// Message Serialization
// ============================================================================

/**
 * Convert UI messages to OpenAI-compatible message format.
 */
export function serializeMessages(uiMessages: UIMessage[]): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    for (const msg of uiMessages) {
        const textParts = msg.parts?.filter((p) => p.type === 'text') ?? [];
        const text = textParts.map((p) => ('text' in p ? p.text : '')).join('\n\n');
        const toolParts = (msg.parts?.filter((p) => p.type === 'tool-invocation') as { toolInvocation: ToolInvocation }[]) ?? [];

        if (msg.role === 'user') {
            if (text.trim()) result.push({ role: 'user', content: text.trim() });
            continue;
        }

        if (msg.role === 'system') {
            if (text.trim()) result.push({ role: 'system', content: text.trim() });
            continue;
        }

        if (msg.role === 'assistant') {
            const toolCalls = toolParts
                .filter((p) => ['call', 'partial-call'].includes(p.toolInvocation.status))
                .map((p) => p.toolInvocation);

            if (text.trim() || toolCalls.length > 0) {
                const assistantMessage: OpenAIMessage = {
                    role: 'assistant',
                    content: text,
                };
                // Only include tool_calls if there are actual calls
                if (toolCalls.length > 0) {
                    (assistantMessage as { tool_calls?: OpenAIToolCall[] }).tool_calls = toolCalls.map((tc) => ({
                        id: tc.toolCallId,
                        type: 'function',
                        function: { name: tc.toolName, arguments: tc.args },
                    }));
                }
                result.push(assistantMessage);
            }

            const toolResults = toolParts.filter((p) => p.toolInvocation.status === 'result');
            for (const part of toolResults) {
                result.push({
                    role: 'tool',
                    tool_call_id: part.toolInvocation.toolCallId,
                    content: JSON.stringify(part.toolInvocation.result ?? { success: true }),
                });
            }
        }
    }

    return result;
}

// ============================================================================
// Tool Mapping
// ============================================================================

/**
 * Convert tool definitions to OpenAI function calling format.
 */
export function mapToolsToOpenAI(tools: ToolDefinition[]) {
    return tools.map((tool) => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}
