import { useState, useCallback } from 'react';
import { copyToClipboard as copyToClipboardUtil } from '../utils/clipboard';

interface UseCopyToClipboardWithKeyOptions {
  resetDelay?: number;
  onSuccess?: (key: string) => void;
  onError?: (error: Error, key: string) => void;
}

export function useCopyToClipboardWithKey(options: UseCopyToClipboardWithKeyOptions = {}) {
  const { resetDelay = 2000, onSuccess, onError } = options;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = useCallback(
    async (text: string, key: string) => {
      if (!text) return;

      try {
        await copyToClipboardUtil(text);
        setCopiedKey(key);
        onSuccess?.(key);

        if (resetDelay > 0) {
          setTimeout(() => {
            setCopiedKey(null);
          }, resetDelay);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to copy to clipboard');
        console.error('Failed to copy to clipboard:', err);
        onError?.(err, key);
      }
    },
    [resetDelay, onSuccess, onError],
  );

  const isCopied = useCallback(
    (key: string) => copiedKey === key,
    [copiedKey],
  );

  return {
    copiedKey,
    copyToClipboard,
    isCopied,
  };
}
