import type { GoogleContent } from '../google/types';

export async function handleCountTokens(request: Request): Promise<Response> {
  const body = (await request.json()) as { contents?: GoogleContent[] };

  let totalChars = 0;
  for (const content of body.contents || []) {
    for (const part of content.parts || []) {
      if (part.text) {
        totalChars += part.text.length;
      }
    }
  }

  const estimatedTokens = Math.ceil(totalChars / 4);

  return new Response(JSON.stringify({ totalTokens: estimatedTokens }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

