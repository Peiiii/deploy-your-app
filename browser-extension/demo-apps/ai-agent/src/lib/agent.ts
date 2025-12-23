/**
 * Gemigo Agent adapter for @agent-labs/agent-chat.
 *
 * Converts AgentChat UI messages to OpenAI-compatible payloads, streams
 * events with @agent-labs/agent-toolkit, and wires Gemigo SDK tool executors.
 */

import type {
  AgentEvent as ChatAgentEvent,
  IAgent,
  RunAgentInput,
  ToolDefinition,
  ToolExecutor,
  ToolInvocation,
  UIMessage,
} from '@agent-labs/agent-chat';
import { convertOpenAIChunksToAgentEventObservable, type OpenAIChatChunk } from '@agent-labs/agent-toolkit';
import { Observable, type Unsubscribable } from 'rxjs';

const API_ENDPOINT = 'https://openai-api.gemigo.io/v1/chat/completions';
const MODEL = 'qwen3-max';
const decoder = new TextDecoder();

type GemigoSDK = {
  extension?: {
    getPageHTML?: () => Promise<string>;
    getSelection?: () => Promise<unknown>;
    highlight?: (selector: string, color?: string) => Promise<unknown>;
    captureVisible?: () => Promise<unknown>;
  };
  network?: {
    request?: (
      url: string,
      options?: { method?: string; headers?: Record<string, string>; body?: unknown; responseType?: string }
    ) => Promise<unknown>;
  };
};

type GemigoWindow = Window & { gemigo?: GemigoSDK };

export const AGENT_TOOL_DEFS: ToolDefinition[] = [
  {
    name: 'getPageHTML',
    description: 'Get the full HTML content of the current visible page to analyze structure and content.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'getSelection',
    description: 'Get the currently selected text on the page.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'highlight',
    description: 'Highlight elements on the page that match a CSS selector.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to highlight' },
        color: { type: 'string', description: 'Highlight color (CSS value)' },
      },
      required: ['selector'],
      additionalProperties: false,
    },
  },
  {
    name: 'captureVisible',
    description: 'Capture a screenshot of the visible portion of the current tab.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'networkRequest',
    description: 'Make an external network request from the extension background.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full request URL' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
        headers: { type: 'object', description: 'Optional request headers' },
        body: { type: ['string', 'object'], description: 'Request body for non-GET verbs' },
        responseType: {
          type: 'string',
          enum: ['json', 'text', 'arraybuffer'],
          description: 'How the response should be parsed',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'calculate',
    description: 'Evaluate a basic mathematical expression (for quick sanity checks).',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'The math expression to evaluate (e.g., "2 + 2 * 3")' },
      },
      required: ['expression'],
      additionalProperties: false,
    },
  },
];

async function* parseOpenAIStream(response: Response): AsyncGenerator<OpenAIChatChunk> {
  if (!response.body) throw new Error('No response body returned from the AI gateway.');

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

function safeEvaluate(expression: string): number {
  const sanitized = expression.replace(/\s+/g, '');
  if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
    throw new Error('Only basic arithmetic is allowed.');
  }
  const result = Function(`"use strict"; return (${expression});`)();
  if (Number.isNaN(result) || !Number.isFinite(result)) {
    throw new Error('Expression did not produce a finite number.');
  }
  return result;
}

const toolExecutors: Record<string, ToolExecutor> = {
  calculate: async (args) => {
    return { success: true, value: safeEvaluate(String((args as { expression?: string })?.expression ?? '')) };
  },
  getPageHTML: async () => {
    const gemigo = (window as GemigoWindow).gemigo;
    if (!gemigo?.extension?.getPageHTML) throw new Error('getPageHTML is unavailable.');
    return { success: true, data: await gemigo.extension.getPageHTML() };
  },
  getSelection: async () => {
    const gemigo = (window as GemigoWindow).gemigo;
    if (!gemigo?.extension?.getSelection) throw new Error('getSelection is unavailable.');
    return { success: true, data: await gemigo.extension.getSelection() };
  },
  highlight: async (args) => {
    const { selector, color } = (args || {}) as { selector?: string; color?: string };
    if (!selector) throw new Error('selector is required for highlight.');
    const gemigo = (window as GemigoWindow).gemigo;
    if (!gemigo?.extension?.highlight) throw new Error('highlight is unavailable.');
    return await gemigo.extension.highlight(selector, color);
  },
  captureVisible: async () => {
    const gemigo = (window as GemigoWindow).gemigo;
    if (!gemigo?.extension?.captureVisible) throw new Error('captureVisible is unavailable.');
    return await gemigo.extension.captureVisible();
  },
  networkRequest: async (args) => {
    const { url, method, headers, body, responseType } = (args || {}) as {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      responseType?: string;
    };
    if (!url) throw new Error('url is required for networkRequest.');
    const gemigo = (window as GemigoWindow).gemigo;
    if (!gemigo?.network?.request) throw new Error('network.request is unavailable.');
    return await gemigo.network.request(url, { method, headers, body, responseType });
  },
};

export const getToolExecutors = () => ({ ...toolExecutors });

type OpenAIToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
type OpenAIMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

function serializeMessages(uiMessages: UIMessage[]): OpenAIMessage[] {
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
        result.push({
          role: 'assistant',
          content: text,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.toolCallId,
            type: 'function',
            function: { name: tc.toolName, arguments: tc.args },
          })),
        });
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

function mapTools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function createGemigoAgent(): IAgent {
  let abortController: AbortController | null = null;

  const agent: IAgent = {
    run: (input: RunAgentInput) => {
      abortController?.abort();
      abortController = new AbortController();

      const events$ = new Observable<ChatAgentEvent>((subscriber) => {
        let innerSub: Unsubscribable | null = null;

        fetch(API_ENDPOINT, {
          method: 'POST',
          signal: abortController?.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL,
            stream: true,
            messages: serializeMessages(input.messages),
            tools: mapTools(input.tools ?? AGENT_TOOL_DEFS),
            tool_choice: 'auto',
          }),
        })
          .then((response) => {
            if (!response.ok) {
              let errorText = `${response.status} ${response.statusText}`;
              response
                .json()
                .then((data) => {
                  errorText = data?.error?.message || errorText;
                  subscriber.error(new Error(errorText));
                })
                .catch(async () => {
                  const fallback = await response.text();
                  subscriber.error(new Error(fallback || errorText));
                });
              return;
            }

            innerSub = convertOpenAIChunksToAgentEventObservable(parseOpenAIStream(response), {
              messageId: `msg-${input.runId || Date.now()}`,
              threadId: input.threadId,
            }).subscribe({
              next: (evt) => subscriber.next(evt as unknown as ChatAgentEvent),
              error: (err) => subscriber.error(err),
              complete: () => subscriber.complete(),
            });
          })
          .catch((err) => subscriber.error(err));

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
