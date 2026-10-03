import { ValidationError } from '../utils/error-handler';

export async function limitedText(
  request: Request,
  maximum: number,
  signal?: AbortSignal
): Promise<string> {
  if (Number(request.headers.get('content-length')) > maximum)
    throw new ValidationError('Request body is too large.');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let value = '';
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new ValidationError('The API request was canceled or timed out.');
      const next = await reader.read();
      if (signal?.aborted) throw new ValidationError('The API request was canceled or timed out.');
      if (next.done) return value + decoder.decode();
      size += next.value.byteLength;
      if (size > maximum) throw new ValidationError('Request body is too large.');
      value += decoder.decode(next.value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}
