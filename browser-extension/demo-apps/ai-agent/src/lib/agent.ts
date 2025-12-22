/**
 * Agent Alchemist - Core Logic
 * 
 * Orchestrates the AI loop using OpenAI Function Calling and GemiGo APIs.
 */

const API_ENDPOINT = 'https://openai-api.gemigo.io/v1/chat/completions';

export interface ToolCall {
    id: string;
    name: string;
    arguments: any;
}

export interface AgentMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}

// Define the tools available to the Agent
// These map to GemiGo HostMethods
export const AGENT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'getPageHTML',
            description: 'Get the full HTML content of the current visible page to analyze its structure and content.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'getSelection',
            description: 'Get the currently selected text on the page.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'highlight',
            description: 'Highlight elements on the page matches a selector or specific text.',
            parameters: {
                type: 'object',
                properties: {
                    selector: { type: 'string', description: 'CSS selector to highlight' },
                    text: { type: 'string', description: 'Text to highlight' },
                    color: { type: 'string', description: 'Highlight color (hex or name)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'captureVisible',
            description: 'Capture a screenshot of the visible portion of the current tab.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'networkRequest',
            description: 'Make an external network request from the background script.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
                    body: { type: 'string' }
                },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calculate',
            description: 'Evaluate a mathematical expression. Use this for basic arithmetic tests.',
            parameters: {
                type: 'object',
                properties: {
                    expression: { type: 'string', description: 'The math expression to evaluate (e.g., "2 + 2")' }
                },
                required: ['expression']
            }
        }
    }
];

export async function runAgentLoop(
    messages: AgentMessage[],
    onUpdate: (messages: AgentMessage[]) => void,
    onToolStart?: (toolName: string) => void
) {
    let currentMessages = [...messages];

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // No API Key needed as per user instructions for this domain
            },
            body: JSON.stringify({
                model: 'qwen3-max', // The gateway will map this appropriately
                messages: currentMessages,
                tools: AGENT_TOOLS,
                tool_choice: 'auto',
            }),
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message || 'API Error');
        }

        const assistantMessage = data.choices[0].message;

        currentMessages.push(assistantMessage);
        onUpdate([...currentMessages]);

        if (assistantMessage.tool_calls) {
            for (const toolCall of assistantMessage.tool_calls) {
                const { name, arguments: argsString } = toolCall.function;
                const args = JSON.parse(argsString);

                onToolStart?.(name);

                console.log(`[Agent] Calling tool: ${name}`, args);

                let result;
                try {
                    if (name === 'calculate') {
                        // Local execution for testing
                        // eslint-disable-next-line no-eval
                        result = { success: true, value: eval(args.expression) };
                    } else {
                        // Execute via the window.gemigo global injected by the extension
                        const gemigo = (window as any).gemigo;
                        console.log(`[Agent] GemiGo Bridge state:`, {
                            available: !!gemigo,
                            methods: gemigo ? Object.keys(gemigo) : []
                        });

                        // Map tool names to SDK paths
                        let toolFn: any = null;
                        if (gemigo) {
                            if (['getPageHTML', 'getSelection', 'highlight', 'captureVisible'].includes(name)) {
                                toolFn = gemigo.extension?.[name];
                            } else if (name === 'networkRequest') {
                                toolFn = gemigo.network?.request;
                            } else {
                                toolFn = gemigo[name] || gemigo.extension?.[name];
                            }
                        }

                        if (toolFn) {
                            if (name === 'networkRequest') {
                                result = await toolFn(args.url, { method: args.method, body: args.body });
                            } else {
                                result = await toolFn(...Object.values(args));
                            }
                        } else {
                            result = { success: false, error: `Tool ${name} not available in GemiGo SDK namespaces. SDK exists: ${!!gemigo}` };
                        }
                    }
                } catch (err) {
                    result = { success: false, error: String(err) };
                }

                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result),
                });
            }

            // After tool results, call AI again to summarize or act further
            return runAgentLoop(currentMessages, onUpdate, onToolStart);
        }

        return currentMessages;
    } catch (error) {
        console.error('[Agent] Loop error:', error);
        currentMessages.push({
            role: 'assistant',
            content: `Error: ${String(error)}`,
        });
        onUpdate([...currentMessages]);
        return currentMessages;
    }
}
