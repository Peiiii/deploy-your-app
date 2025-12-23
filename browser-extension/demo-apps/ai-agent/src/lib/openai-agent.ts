/**
 * OpenAI Agent Factory for @agent-labs.
 * 
 * Provides a simple, opinionated way to create an IAgent that works with
 * OpenAI-compatible APIs (OpenAI, Azure, Anthropic, local models, etc.)
 */

import type { AgentEvent as ChatAgentEvent, IAgent, RunAgentInput, ToolDefinition } from '@agent-labs/agent-chat';
import { convertOpenAIChunksToAgentEventObservable } from '@agent-labs/agent-toolkit';
import { Observable, type Unsubscribable } from 'rxjs';

import { parseOpenAIStream, serializeToOpenAI, mapToolsToOpenAI } from './openai-adapter';

// ============================================================================
// Types
// ============================================================================

export interface OpenAIAgentOptions {
    /**
     * API endpoint URL.
     * @example 'https://api.openai.com/v1/chat/completions'
     */
    endpoint: string;

    /**
     * Model identifier.
     * @example 'gpt-4o', 'gpt-3.5-turbo', 'claude-3-opus'
     */
    model: string;

    /**
     * API key for authentication.
     * If not provided, requests are sent without Authorization header.
     */
    apiKey?: string;

    /**
     * Default tool definitions to use if not provided in run().
     */
    defaultTools?: ToolDefinition[];

    /**
     * Additional headers to send with each request.
     */
    headers?: Record<string, string>;

    /**
     * Enable debug logging.
     * @default false
     */
    debug?: boolean;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an IAgent that works with OpenAI-compatible APIs.
 * 
 * @example
 * ```ts
 * const agent = createOpenAIAgent({
 *   endpoint: 'https://api.openai.com/v1/chat/completions',
 *   model: 'gpt-4o',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 * 
 * // Use with AgentChat
 * const { sessionManager } = useAgentChat({ agent, toolDefs, toolExecutors });
 * ```
 */
export function createOpenAIAgent(options: OpenAIAgentOptions): IAgent {
    const { endpoint, model, apiKey, defaultTools = [], headers = {}, debug = false } = options;

    let abortController: AbortController | null = null;

    const log = debug
        ? (...args: unknown[]) => console.log('[OpenAIAgent]', ...args)
        : () => { };

    const agent: IAgent = {
        run: (input: RunAgentInput) => {
            // Abort any previous run
            abortController?.abort();
            abortController = new AbortController();

            const events$ = new Observable<ChatAgentEvent>((subscriber) => {
                let innerSub: Unsubscribable | null = null;

                const requestHeaders: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...headers,
                };

                if (apiKey) {
                    requestHeaders['Authorization'] = `Bearer ${apiKey}`;
                }

                const tools = input.tools ?? defaultTools;
                const body = {
                    model,
                    stream: true,
                    messages: serializeToOpenAI(input.messages),
                    ...(tools.length > 0 && {
                        tools: mapToolsToOpenAI(tools),
                        tool_choice: 'auto',
                    }),
                };

                log('Request:', { endpoint, model, messageCount: input.messages.length });

                fetch(endpoint, {
                    method: 'POST',
                    signal: abortController?.signal,
                    headers: requestHeaders,
                    body: JSON.stringify(body),
                })
                    .then((response) => {
                        if (!response.ok) {
                            handleErrorResponse(response, subscriber, log);
                            return;
                        }

                        log('Response OK, starting stream');

                        innerSub = convertOpenAIChunksToAgentEventObservable(parseOpenAIStream(response), {
                            messageId: `msg-${input.runId || Date.now()}`,
                            threadId: input.threadId,
                        }).subscribe({
                            next: (evt) => subscriber.next(evt as unknown as ChatAgentEvent),
                            error: (err) => {
                                log('Stream error:', err);
                                subscriber.error(err);
                            },
                            complete: () => {
                                log('Stream complete');
                                subscriber.complete();
                            },
                        });
                    })
                    .catch((err) => {
                        log('Fetch error:', err);
                        subscriber.error(err);
                    });

                return () => {
                    abortController?.abort();
                    innerSub?.unsubscribe();
                };
            });

            return events$;
        },

        abortRun: () => abortController?.abort(),
    };

    return agent;
}

// ============================================================================
// Helpers
// ============================================================================

function handleErrorResponse(
    response: Response,
    subscriber: { error: (err: Error) => void },
    log: (...args: unknown[]) => void
): void {
    let errorText = `${response.status} ${response.statusText}`;

    response
        .json()
        .then((data) => {
            errorText = data?.error?.message || errorText;
            log('API error:', errorText);
            subscriber.error(new Error(errorText));
        })
        .catch(async () => {
            const fallback = await response.text();
            log('API error (fallback):', fallback || errorText);
            subscriber.error(new Error(fallback || errorText));
        });
}
