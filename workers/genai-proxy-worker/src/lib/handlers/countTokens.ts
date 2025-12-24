import { normalizeGenerateContentRequest } from '../google/normalize';

export async function handleCountTokens(request: Request): Promise<Response> {
  const normalizeResult = normalizeGenerateContentRequest(await request.json());
  if (normalizeResult.error) {
    return new Response(JSON.stringify({ error: normalizeResult.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const body = normalizeResult.value;

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
