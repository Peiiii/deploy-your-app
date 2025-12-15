export async function copyToClipboard(text: string): Promise<void> {
  if (!text) {
    throw new Error('Text is required');
  }

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn('Clipboard API failed, falling back to execCommand', error);
    }
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  textArea.style.opacity = '0';
  textArea.setAttribute('readonly', '');
  textArea.setAttribute('aria-hidden', 'true');
  document.body.appendChild(textArea);

  try {
    textArea.focus();
    textArea.select();
    
    const range = document.createRange();
    range.selectNodeContents(textArea);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    const successful = document.execCommand('copy');
    if (!successful) {
      throw new Error('execCommand copy failed');
    }
  } finally {
    if (document.body.contains(textArea)) {
      document.body.removeChild(textArea);
    }
  }
}
