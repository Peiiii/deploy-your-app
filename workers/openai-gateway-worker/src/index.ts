import type { Env } from './lib/env';
import { createWorkerApp } from '@deploy-your-app/worker-kit';
import { handleChatCompletions } from './lib/handlers/chatCompletions';
import { handleModels } from './lib/handlers/models';

const app = createWorkerApp<Env>();

app.get('/health', (c) => c.text('ok'));

app.get('/v1/models', (c) => handleModels(c.env));
app.post('/v1/chat/completions', (c) => handleChatCompletions(c.req.raw, c.env));

export default app.getWorker();

