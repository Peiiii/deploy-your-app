/**
 * Agent Factory for the Agent Alchemist.
 * 
 * This is the main entry point that creates an IAgent instance
 * compatible with @agent-labs/agent-chat.
 */

import type { AgentEvent as ChatAgentEvent, IAgent, RunAgentInput } from '@agent-labs/agent-chat';
import { convertOpenAIChunksToAgentEventObservable } from '@agent-labs/agent-toolkit';
import { Observable, type Unsubscribable } from 'rxjs';

import { API_ENDPOINT, MODEL } from './config';
import { parseOpenAIStream, serializeMessages, mapToolsToOpenAI } from './openai-adapter';
import { AGENT_TOOL_DEFS } from './tools/definitions';

// Re-export for convenience
export { AGENT_TOOL_DEFS } from './tools/definitions';
export { getToolExecutors } from './tools/executors';

/**
 * Create a GemiGo-powered agent instance.
 * 
 * The agent converts UI messages to OpenAI format, streams responses,
 * and integrates with the GemiGo SDK for browser tool execution.
 */
export function createGemigoAgent(): IAgent {
    let abortController: AbortController | null = null;

    const agent: IAgent = {
        run: (input: RunAgentInput) => {
            // Abort any previous run
            abortController?.abort();
            abortController = new AbortController();

            const events$ = new Observable<ChatAgentEvent>((subscriber) => {
                let innerSub: Unsubscribable | null = null;

                fetch(API_ENDPOINT, {
                    method: 'POST',
                    signal: abortController?.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        ...(import.meta.env.VITE_OPENAI_API_KEY && {
                            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
                        }),
                    },
                    body: JSON.stringify({
                        model: MODEL,
                        stream: true,
                        messages: serializeMessages(input.messages),
                        tools: mapToolsToOpenAI(input.tools ?? AGENT_TOOL_DEFS),
                        tool_choice: 'auto',
                    }),
                })

                    .then((response) => {
                        if (!response.ok) {
                            handleErrorResponse(response, subscriber);
                            return;
                        }

                        innerSub = convertOpenAIChunksToAgentEventObservable(parseOpenAIStream(response), {
                            messageId: `msg-${input.runId || Date.now()}`,
                            threadId: input.threadId,
                        }).subscribe({
                            next: (evt) => subscriber.next(evt as unknown as ChatAgentEvent),
                            error: (err) => {
                                console.error('[Agent] Stream error:', err);
                                subscriber.error(err);
                            },
                            complete: () => subscriber.complete(),
                        });
                    })
                    .catch((err) => {
                        console.error('[Agent] Fetch error:', err);
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

/**
 * Handle error responses from the API.
 */
function handleErrorResponse(
    response: Response,
    subscriber: { error: (err: Error) => void }
): void {
    let errorText = `${response.status} ${response.statusText}`;

    response
        .json()
        .then((data) => {
            errorText = data?.error?.message || errorText;
            console.error('[Agent] API error:', errorText);
            subscriber.error(new Error(errorText));
        })
        .catch(async () => {
            const fallback = await response.text();
            console.error('[Agent] API error (fallback):', fallback || errorText);
            subscriber.error(new Error(fallback || errorText));
        });
}
