import type { Env } from '../env';

export function handleModels(env: Env): Response {
  const created = Math.floor(Date.now() / 1000);
  const body = {
    object: 'list',
    data: [
      {
        id: env.DEFAULT_MODEL,
        object: 'model',
        created,
        owned_by: 'gemigo',
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

