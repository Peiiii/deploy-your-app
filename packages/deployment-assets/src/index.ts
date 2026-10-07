const GOOGLE_ENDPOINT_PREFIXES = ['https://generativelanguage.googleapis.com', 'https://aistudio.googleapis.com', 'https://aistudio.google.com', 'https://ai.google.dev'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function looksLikeGenAIClient(content: string): boolean {
  return (
    /@google\/gen(erative-ai|ai)\b/.test(content) ||
    /\bGoogleGenerativeAI\b/.test(content) ||
    /\bGoogleAI(Client)?\b/.test(content) ||
    /generativelanguage\.googleapis\.com/.test(content)
  );
}

function ensureBaseAndEndpointInObject(
  objectSource: string,
  targetBaseUrl: string,
): string {
  const basePattern = /baseUrl\s*:\s*(['"`])[^'"`]*\1/;
  const endpointPattern = /apiEndpoint\s*:\s*(['"`])[^'"`]*\1/;
  let updated = objectSource;

  const hasBase = basePattern.test(updated);
  const hasEndpoint = endpointPattern.test(updated);

  if (hasBase) {
    updated = updated.replace(basePattern, `baseUrl: '${targetBaseUrl}'`);
  }
  if (hasEndpoint) {
    updated = updated.replace(
      endpointPattern,
      `apiEndpoint: '${targetBaseUrl}'`,
    );
  }

  if (hasBase && hasEndpoint) {
    return updated;
  }

  const trimmed = updated.trimEnd();
  const closeIdx = trimmed.lastIndexOf('}');
  if (closeIdx === -1) return updated;

  const before = updated.slice(0, closeIdx);
  const after = updated.slice(closeIdx);
  const needsComma = /{\s*$/.test(before.trim()) ? '' : ',';
  const indentMatch = before.match(/(\n\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : ' ';

  const additions: string[] = [];
  if (!hasBase) additions.push(`baseUrl: '${targetBaseUrl}'`);
  if (!hasEndpoint) additions.push(`apiEndpoint: '${targetBaseUrl}'`);

  return `${before}${needsComma}${indent}${additions.join(
    `,${indent}`,
  )}${after}`;
}

function upsertHttpOptions(objectSource: string, targetBaseUrl: string): string {
  const httpOptionsPattern = /httpOptions\s*:\s*{([\s\S]*?)}/m;

  if (httpOptionsPattern.test(objectSource)) {
    return objectSource.replace(httpOptionsPattern, (_match, inner) => {
      const withBase = ensureBaseAndEndpointInObject(
        `{${inner}}`,
        targetBaseUrl,
      );
      return `httpOptions: ${withBase}`;
    });
  }

  const trimmed = objectSource.trimEnd();
  const closeIdx = trimmed.lastIndexOf('}');
  if (closeIdx === -1) return objectSource;

  const before = objectSource.slice(0, closeIdx);
  const after = objectSource.slice(closeIdx);
  const needsComma = /{\s*$/.test(before.trim()) ? '' : ',';
  const indentMatch = before.match(/(\n\s*)[^\n]*$/);
  const indent = indentMatch ? indentMatch[1] : ' ';

  return `${before}${needsComma}${indent}httpOptions: { baseUrl: '${targetBaseUrl}', apiEndpoint: '${targetBaseUrl}' }${after}`;
}

function rewriteGoogleGenAIStyleInstances(
  source: string,
  targetBaseUrl: string,
): string {
  let updated = source;
  const classNames = ['GoogleGenerativeAI', 'GoogleGenAI'];

  for (const className of classNames) {
    const withOptions = new RegExp(
      `new\\s+${className}\\s*\\(\\s*({[\\s\\S]*?})\\s*\\)`,
      'g',
    );
    updated = updated.replace(withOptions, (full, options) => {
      const withHttpOptions = upsertHttpOptions(options, targetBaseUrl);
      return full.replace(options, withHttpOptions);
    });

    const withApiKeyOnly = new RegExp(
      `new\\s+${className}\\s*\\(\\s*([^)]+?)\\s*\\)`,
      'g',
    );
    updated = updated.replace(withApiKeyOnly, (full, arg) => {
      if (/{/.test(arg)) {
        return full;
      }
      const trimmedArg = arg.trim();
      if (trimmedArg.length === 0) {
        return full;
      }
      return `new ${className}({ apiKey: ${trimmedArg}, httpOptions: { baseUrl: '${targetBaseUrl}', apiEndpoint: '${targetBaseUrl}' } })`;
    });
  }

  return updated;
}

function rewriteGoogleAIClientInstances(
  source: string,
  targetBaseUrl: string,
): string {
  let updated = source;

  updated = updated.replace(
    /new\s+(GoogleAIClient|GoogleAI)\s*\(\s*({[\s\S]*?})\s*\)/g,
    (full, _className, options) => {
      const withTopLevelBase = ensureBaseAndEndpointInObject(
        options,
        targetBaseUrl,
      );
      const withHttpOptions = upsertHttpOptions(
        withTopLevelBase,
        targetBaseUrl,
      );
      return full.replace(options, withHttpOptions);
    },
  );

  updated = updated.replace(
    /new\s+(GoogleAIClient|GoogleAI)\s*\(\s*([^)]+?)\s*\)/g,
    (full, className, arg) => {
      if (/{/.test(arg)) {
        return full;
      }
      const trimmedArg = arg.trim();
      if (trimmedArg.length === 0) {
        return full;
      }
      return `new ${className}({ apiKey: ${trimmedArg}, httpOptions: { baseUrl: '${targetBaseUrl}', apiEndpoint: '${targetBaseUrl}' } })`;
    },
  );

  return updated;
}

export function applyRuleBasedRewrite(
  content: string,
  targetBaseUrl: string,
): string {
  let updated = content;

  for (const endpoint of GOOGLE_ENDPOINT_PREFIXES) {
    updated = updated.replace(
      new RegExp(escapeRegExp(endpoint), 'g'),
      targetBaseUrl,
    );
  }

  updated = updated.replace(
    /(baseUrl|apiEndpoint)\s*:\s*(['"`])[^'"`]*\2/g,
    `$1: '${targetBaseUrl}'`,
  );

  updated = rewriteGoogleGenAIStyleInstances(updated, targetBaseUrl);
  updated = rewriteGoogleAIClientInstances(updated, targetBaseUrl);

  return updated;
}
