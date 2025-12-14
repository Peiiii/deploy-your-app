// Minimal OpenAI-compatible mock server for local testing.
// Supports:
//   POST /v1/chat/completions (stream + non-stream)
//
// Run:
//   node workers/genai-proxy-worker/dev/mock-openai.js

import http from 'node:http';

const PORT = Number(process.env.PORT || 19000);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += String(chunk);
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('missing url');
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    const body = await readJson(req);
    const stream = Boolean(body.stream);

    if (stream) {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });

      sse(res, {
        id: 'chatcmpl_mock',
        object: 'chat.completion.chunk',
        choices: [{ delta: { content: 'Hello' }, index: 0 }],
      });
      sse(res, {
        id: 'chatcmpl_mock',
        object: 'chat.completion.chunk',
        choices: [{ delta: { content: ' from mock upstream.' }, index: 0 }],
      });
      sse(res, {
        id: 'chatcmpl_mock',
        object: 'chat.completion.chunk',
        choices: [{ delta: {}, finish_reason: 'stop', index: 0 }],
      });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'chatcmpl_mock',
        object: 'chat.completion',
        choices: [
          {
            message: { role: 'assistant', content: 'Hello from mock upstream.' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 5, total_tokens: 6 },
      }),
    );
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock-openai listening on http://127.0.0.1:${PORT}`);
});

