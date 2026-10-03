/** Preserve backpressure while bounding output and redacting secrets across chunks. */
export function protectedStream(
  body: ReadableStream<Uint8Array>,
  key: string,
  onEnd: () => void
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let bytes = 0;
  let tail = '';
  const output = new ReadableStream<Uint8Array>({
    pull: async (controller) => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          bytes += value?.byteLength || 0;
          if (bytes > 16 * 1048576) throw new Error('Output limit');
          tail += decoder.decode(value, { stream: !done });
          // Retain a suffix so even a credential echoed across chunk boundaries is redacted.
          if (done) {
            controller.enqueue(encoder.encode(tail.split(key).join('[redacted]')));
            controller.close();
            onEnd();
            return;
          }
          const safeLength = Math.max(0, tail.length - key.length + 1);
          const match = tail.lastIndexOf(key, safeLength - 1);
          const end =
            match >= 0 && match < safeLength && match + key.length > safeLength
              ? match
              : safeLength;
          if (end > 0) {
            controller.enqueue(encoder.encode(tail.slice(0, end).split(key).join('[redacted]')));
            tail = tail.slice(end);
            return;
          }
        }
      } catch {
        controller.error(new Error('The API stream ended.'));
        onEnd();
      }
    },
    cancel: async () => {
      onEnd();
      await reader.cancel().catch(() => {});
    },
  });

  return output;
}
