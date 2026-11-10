import { normalizeAppLanguageCode } from './app-language';

const MAX_HTML_BYTES = 128 * 1024;

/** Read only a bounded source prefix; never download scripts or execute the app. */
export async function readStaticHtml(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remaining = MAX_HTML_BYTES;
  let html = '';
  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, remaining);
      html += decoder.decode(part, { stream: true });
      remaining -= part.byteLength;
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function attribute(tag: string, name: string): string {
  const found = tag.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\x60]+))`, 'i')
  );
  return found ? (found[1] ?? found[2] ?? found[3] ?? '') : '';
}

function plainText(html: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(
      /&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi,
      (_, decimal: string, hex: string, name: string) => {
        if (name) return named[name.toLowerCase()];
        const point = parseInt(decimal || hex, decimal ? 10 : 16);
        return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point)
          : ' ';
      }
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function distinctiveLanguage(text: string): string | undefined {
  const counts = [
    ['ja', (text.match(/[\u3040-\u30ff]/gu) ?? []).length],
    ['ko', (text.match(/[\uac00-\ud7af]/gu) ?? []).length],
    ['th', (text.match(/[\u0e00-\u0e7f]/gu) ?? []).length],
    ['zh', (text.match(/[\u3400-\u9fff]/gu) ?? []).length],
  ] as const;
  // Kana distinguishes Japanese even when most characters are shared Han glyphs.
  if (counts[0][1] >= 4) return 'ja';
  const ranked = [...counts.slice(1)].sort((a, b) => b[1] - a[1]);
  return ranked[0][1] >= 8 && ranked[0][1] >= ranked[1][1] * 2 ? ranked[0][0] : undefined;
}

/** Best-effort source evidence, deliberately not a claim about executed UI. */
export function detectStaticAppLanguages(source: string): string[] {
  const html = source
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|template|noscript|svg)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ');
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? '';
  const declarations = [attribute(htmlTag, 'lang')];
  const descriptions: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (
      attribute(tag, 'name') ||
      attribute(tag, 'property') ||
      attribute(tag, 'http-equiv')
    ).toLowerCase();
    const content = attribute(tag, 'content');
    if (['description', 'og:description', 'twitter:description', 'og:title'].includes(key))
      descriptions.push(content);
    if (['content-language', 'og:locale'].includes(key))
      declarations.push(content.replaceAll('_', '-'));
  }
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '';
  const controls = plainText(
    (html.match(/<(button|label|nav|h1|h2)\b[^>]*>[\s\S]*?<\/\1\s*>/gi) ?? []).join(' ')
  );
  const body = plainText(html.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, ' '));
  const evidence = plainText([title, ...descriptions, body].join(' '));
  if (evidence.replace(/\s/g, '').length < 20) return [];
  const declared = declarations
    .map(normalizeAppLanguageCode)
    .find((code) => code && code !== 'zxx');
  const interfaceLanguage = distinctiveLanguage(controls);
  if (interfaceLanguage) return [interfaceLanguage];
  if (declared && controls.replace(/\s/g, '').length >= 20) return [declared];
  const distinctive = distinctiveLanguage(evidence);
  if (distinctive) return [distinctive];
  return declared ? [declared] : [];
}
