import assert from 'node:assert/strict';
import * as catalogModule from '../frontend/src/constants/app-categories';
const { CATEGORIES, getCategoryLabelKey } =
  (catalogModule as typeof catalogModule & { default?: typeof catalogModule }).default ??
  catalogModule;
import { aiService } from '../workers/api/src/services/ai.service';
import type { ApiWorkerEnv } from '../workers/api/src/types/env';

process.env.STORAGE_TYPE = 'file';
process.env.DEPLOY_TARGET = 'local';
process.env.DASHSCOPE_API_KEY = 'test-credential';
const { AIService } = await import('../server/src/modules/ai/ai.service');
const node = new AIService();
const env = { DASHSCOPE_API_KEY: 'test-credential' } as ApiWorkerEnv;
const categories = ['Education', 'Games', 'Productivity', 'Creative', 'Development', 'Other'];
assert.deepEqual([...CATEGORIES], ['All Apps', ...categories]);
assert.equal(getCategoryLabelKey('Future'), 'explore.other');
const originalFetch = globalThis.fetch;
let category = '';
let requests = 0;
globalThis.fetch = async (_input, init) => {
  const body = JSON.parse(init!.body as string);
  assert.deepEqual(body.response_format.json_schema.schema.properties.category.enum, categories);
  const prompt = body.messages[0].content;
  assert.ok(prompt.includes('actual content') && prompt.includes('educational games'));
  assert.ok(!prompt.includes('Fun'));
  requests++;
  return Response.json({
    choices: [
      {
        message: {
          content: JSON.stringify({
            name: 'Math Quest',
            category,
            tags: ['game'],
            description: 'Practice multiplication through play.',
            slug: 'math-quest',
          }),
        },
      },
    ],
  });
};
try {
  for (const value of [...categories, 'Fun', 'Imagined Category']) {
    category = value;
    const expected = categories.includes(value) ? value : null;
    assert.equal(
      (await aiService.generateProjectMetadata(env, 'Math Quest', 'html', 'Multiplication game'))
        .category,
      expected
    );
    assert.equal(
      (await node.generateProjectMetadata('Math Quest', 'html', 'Multiplication game')).category,
      expected
    );
    assert.equal(await node.classifyProjectCategory('Math Quest', 'html'), expected);
  }
  assert.equal(requests, 24);
  console.log(
    'PASS taxonomy: shared UI order; both real AI schemas/parsers and Node category classifier; invalid outputs rejected.'
  );
} finally {
  globalThis.fetch = originalFetch;
}
