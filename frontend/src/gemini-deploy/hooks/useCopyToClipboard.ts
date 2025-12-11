import { useState, useCallback } from 'react';

interface UseCopyToClipboardOptions {
  resetDelay?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useCopyToClipboard(options: UseCopyToClipboardOptions = {}) {
  const { resetDelay = 2000, onSuccess, onError } = options;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(
    async (text: string) => {
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onSuccess?.();

        if (resetDelay > 0) {
          setTimeout(() => {
            setCopied(false);
          }, resetDelay);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to copy to clipboard');
        console.error('Failed to copy to clipboard:', err);
        onError?.(err);
      }
    },
    [resetDelay, onSuccess, onError],
  );

  return {
    copied,
    copyToClipboard,
  };
}
