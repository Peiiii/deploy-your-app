import { projectService } from '../services/project.service';
import type { ApiWorkerEnv } from '../types/env';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../utils/error-handler';
import { gatewayJson } from './response';
import { checkPublicDns, connectionName, parseConnection, type ConnectionConfig } from './config';
import { decryptSecret, encryptSecret } from './vault';
import { limitedText } from './body';
import { protectedStream } from './stream';
import { GatewayRepository } from './repository';

interface ActiveCall {
  connection: string;
  secret: string;
  stop: () => void;
}

/** One project owns all its in-flight calls, revocation and transport lifecycle. */
export class AppGateway {
  private deleted = false;
  private active = new Map<string, ActiveCall>();
  constructor(
    private state: DurableObjectState,
    private env: ApiWorkerEnv
  ) {}

  async fetch(request: Request): Promise<Response> {
    try {
      const projectId = request.headers.get('x-project-id');
      if (!projectId) throw new ForbiddenError();
      const repo = new GatewayRepository(this.env.PROJECTS_DB, projectId);
      const [operation, rawName] = new URL(request.url).pathname.slice(1).split('/');
      const name = rawName ? connectionName(decodeURIComponent(rawName)) : '';
      if (operation === 'delete-project' && request.method === 'DELETE') {
        return await this.state.blockConcurrencyWhile(async () => {
          const project = await projectService.getProjectById(this.env.PROJECTS_DB, projectId);
          if (!project || project.ownerId !== request.headers.get('x-owner-id'))
            throw new NotFoundError('Project not found.');
          this.deleted = true;
          this.stopCalls(() => true);
          try {
            // Fail closed during deletion; retries can finish an interrupted cleanup.
            await this.state.storage.put('deleted', true);
            await repo.purge();
            if (
              !(await projectService.deleteProject(
                this.env.PROJECTS_DB,
                projectId,
                project.ownerId
              ))
            )
              throw new NotFoundError('Project not found.');
            return new Response(null, { status: 204 });
          } catch (error) {
            this.deleted = false;
            await this.state.storage.delete('deleted');
            throw error;
          }
        });
      }
      if (this.deleted || (await this.state.storage.get('deleted')))
        throw new NotFoundError('Project was deleted.');

      if (operation === 'settings' && request.method === 'GET')
        return gatewayJson({ ...(await repo.list()), usage: await repo.usage() });
      if (operation === 'secrets') {
        if (request.method === 'PUT') {
          const { value } = (await request.json()) as { value: string };
          const version = (await repo.secret(name))?.version + 1 || 1;
          await repo.saveSecret(
            name,
            await encryptSecret(this.env.APP_SECRETS_KEYS, projectId, name, version, value),
            version
          );
        } else if (request.method === 'DELETE') await repo.deleteSecret(name);
        else throw new ValidationError('Unsupported operation.');
        this.stopCalls((call) => call.secret === name);
        return gatewayJson({ ok: true });
      }
      if (operation === 'connections' && request.method === 'PUT') {
        const config = parseConnection(name, await request.json());
        if (!(await repo.secret(config.secretName)))
          throw new ValidationError('Create the referenced Secret first.');
        await checkPublicDns(config.baseUrl);
        await repo.saveConnection(config);
        this.stopCalls((call) => call.connection === name);
        return gatewayJson({ ok: true });
      }
      if (operation === 'ticket' && request.method === 'POST') {
        const { subject, origin } = (await request.json()) as { subject: string; origin: string };
        const connection = await repo.connection(name);
        if (!connection) throw new NotFoundError('Connection not found.');
        const config: ConnectionConfig = JSON.parse(connection.config);
        if (!config.enabled) throw new ForbiddenError('Connection is disabled.');
        const secret = await repo.secret(config.secretName);
        if (!secret) throw new ValidationError('The connection Secret was removed.');
        return gatewayJson(await repo.reserve(connection, secret, subject, origin));
      }
      if (operation === 'invoke') return await this.invoke(request, repo, name);
      if (operation === 'test' && request.method === 'POST') return await this.test(repo, name);
      throw new NotFoundError();
    } catch (error) {
      return gatewayJson(
        {
          error:
            error instanceof AppError
              ? error.message
              : 'The connection could not complete. Check the endpoint, Key and model permissions.',
          code: error instanceof AppError ? error.code : 'UPSTREAM_ERROR',
        },
        error instanceof AppError ? error.statusCode : 502
      );
    }
  }

  private stopCalls(predicate: (call: ActiveCall) => boolean): void {
    for (const call of this.active.values()) if (predicate(call)) call.stop();
  }

  private async invoke(request: Request, repo: GatewayRepository, name: string): Promise<Response> {
    const lease = await repo.consume(
      request.headers.get('x-gemigo-ticket') || '',
      name,
      request.headers.get('origin') || ''
    );
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    let closed = false;
    let socketClose: (() => void) | undefined;
    const stop = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      abort.abort();
      socketClose?.();
      this.active.delete(lease.id);
      this.state.waitUntil(repo.finish(lease.id));
    };
    try {
      const connection = await repo.connection(name);
      if (!connection || connection.revision !== lease.revision)
        throw new ForbiddenError('Connection settings changed. Please reconnect.');
      const config: ConnectionConfig = JSON.parse(connection.config);
      const secret = await repo.secret(config.secretName);
      if (this.deleted || !config.enabled || !secret || secret.version !== lease.secret_version)
        throw new ForbiddenError('Connection or Secret was revoked.');
      this.active.set(lease.id, { connection: name, secret: config.secretName, stop });
      const deadline = Math.min(
        lease.expires_at,
        (lease.consumed_at || Date.now()) + config.limits.durationSeconds * 1000
      );
      timer = setTimeout(stop, Math.max(0, deadline - Date.now()));
      const key = await decryptSecret(
        this.env.APP_SECRETS_KEYS,
        repo.projectId,
        secret.name,
        secret.version,
        { ciphertext: secret.ciphertext, keyVersion: secret.key_version }
      );
      if (/[\r\n]/.test(key))
        throw new ValidationError('This Secret cannot be used in an HTTP authentication header.');
      await checkPublicDns(config.baseUrl);
      if (closed || this.deleted) throw new ForbiddenError('Connection was revoked.');
      const headers = new Headers({ [config.authHeader]: config.authPrefix + key });
      if (config.protocol === 'qwen-realtime') {
        if (request.headers.get('upgrade') !== 'websocket')
          throw new ValidationError('This connection requires WebSocket.');
        const result = await this.realtime(config, headers, abort.signal, key, stop);
        socketClose = result.close;
        if (closed) result.close();
        return result.response;
      }
      if (request.method !== 'POST')
        throw new ValidationError('Invoke an HTTP connection with POST.');
      const raw = await limitedText(request, 1048576, abort.signal);
      if (raw.length > 1048576) throw new ValidationError('Request body exceeds 1 MiB.');
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw);
      } catch {
        throw new ValidationError('Send a JSON request body.');
      }
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new ValidationError('Send a JSON object.');
      let target = config.baseUrl;
      let method = config.method;
      if (config.protocol === 'openai-chat') {
        const model = typeof body.model === 'string' ? body.model : config.models[0];
        if (!config.models.includes(model))
          throw new ForbiddenError('This model is not enabled for the connection.');
        body.model = model;
        delete body.max_completion_tokens;
        body.max_tokens = Math.min(
          config.limits.outputTokens,
          typeof body.max_tokens === 'number' && body.max_tokens > 0
            ? body.max_tokens
            : config.limits.outputTokens
        );
        body.n = 1;
        target += /\/v1$/.test(target) ? '/chat/completions' : '/v1/chat/completions';
        method = 'POST';
      } else target += config.path;
      headers.set('content-type', 'application/json');
      const upstream = await fetch(target, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(body) : undefined,
        redirect: 'manual',
        signal: abort.signal,
      });
      if (!upstream.ok || upstream.status >= 300 || !upstream.body) {
        await upstream.body?.cancel();
        throw new AppError(
          upstream.status === 401 || upstream.status === 403
            ? 'The upstream rejected the Key or model permissions.'
            : `Upstream returned HTTP ${upstream.status}. Check the configured endpoint.`,
          502,
          'UPSTREAM_ERROR'
        );
      }
      const contentType = (upstream.headers.get('content-type') || 'application/json')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (
        !/^(application\/(json|[a-z0-9.+-]+\+json)|text\/(plain|event-stream))$/.test(contentType)
      ) {
        await upstream.body.cancel();
        throw new ValidationError('This gateway supports JSON, text and SSE responses.');
      }
      const output = protectedStream(upstream.body, key, stop);
      return new Response(output, {
        headers: {
          'content-type': contentType,
          'cache-control': 'no-store',
          'access-control-allow-origin': lease.origin,
          'x-content-type-options': 'nosniff',
        },
      });
    } catch (error) {
      stop();
      throw error;
    }
  }

  private async realtime(
    config: ConnectionConfig,
    headers: Headers,
    signal: AbortSignal,
    key: string,
    stop: () => void
  ): Promise<{ response: Response; close: () => void }> {
    const url = new URL(config.baseUrl);
    url.searchParams.set('model', config.models[0]);
    headers.set('upgrade', 'websocket');
    const upstreamResponse = await fetch(url.href, { headers, redirect: 'manual', signal });
    const upstream = upstreamResponse.webSocket;
    if (!upstream)
      throw new AppError(
        `Realtime handshake failed (HTTP ${upstreamResponse.status}). Check the URL, Key and model.`,
        502
      );
    const pair = new WebSocketPair();
    const browser = pair[0];
    const client = pair[1];
    upstream.accept();
    client.accept();
    let transferred = 0;
    let lastSecond = 0;
    let secondBytes = 0;
    const close = () => {
      try {
        upstream.close(1000, 'Connection ended');
      } catch {
        /* already closed */
      }
      try {
        client.close(1000, 'Connection ended');
      } catch {
        /* already closed */
      }
    };
    upstream.addEventListener('message', (event) => {
      if (client.readyState !== WebSocket.OPEN) return stop();
      if (typeof event.data !== 'string') return stop();
      transferred += event.data.length;
      if (transferred > 16 * 1048576) return stop();
      client.send(event.data.split(key).join('[redacted]'));
    });
    client.addEventListener('message', (event) => {
      if (
        upstream.readyState !== WebSocket.OPEN ||
        typeof event.data !== 'string' ||
        event.data.length > 96000
      )
        return stop();
      const second = Math.floor(Date.now() / 1000);
      if (second !== lastSecond) {
        lastSecond = second;
        secondBytes = 0;
      }
      secondBytes += event.data.length;
      if (secondBytes > 256000) return stop();
      try {
        const message = JSON.parse(event.data);
        if (
          ![
            'session.update',
            'input_audio_buffer.append',
            'input_audio_buffer.clear',
            'input_audio_buffer.commit',
            'response.create',
            'response.cancel',
          ].includes(message.type)
        )
          return;
        if (message.type === 'session.update') {
          const session = message.session || {};
          message.session = {
            modalities: ['text', 'audio'],
            voice:
              typeof session.voice === 'string' && /^[\w-]{1,32}$/.test(session.voice)
                ? session.voice
                : 'Cherry',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm24',
            instructions:
              typeof session.instructions === 'string' ? session.instructions.slice(0, 8000) : '',
            input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              silence_duration_ms: Math.max(
                400,
                Math.min(1500, Number(session.turn_detection?.silence_duration_ms) || 800)
              ),
            },
          };
        }
        if (message.type === 'response.create')
          message.response = {
            instructions:
              typeof message.response?.instructions === 'string'
                ? message.response.instructions.slice(0, 8000)
                : '',
          };
        if (
          message.type === 'input_audio_buffer.append' &&
          (typeof message.audio !== 'string' ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(message.audio) ||
            message.audio.length > 64000)
        )
          return stop();
        upstream.send(JSON.stringify(message));
      } catch {
        stop();
      }
    });
    for (const socket of [upstream, client]) {
      socket.addEventListener('close', () => {
        close();
        stop();
      });
      socket.addEventListener('error', () => {
        close();
        stop();
      });
    }
    signal.addEventListener('abort', close, { once: true });
    return { response: new Response(null, { status: 101, webSocket: browser }), close };
  }

  private async test(repo: GatewayRepository, name: string): Promise<Response> {
    const row = await repo.connection(name);
    if (!row) throw new NotFoundError();
    const config: ConnectionConfig = JSON.parse(row.config);
    const secret = await repo.secret(config.secretName);
    if (!secret) throw new ValidationError('Secret not found.');
    if (!config.enabled) throw new ForbiddenError('Enable the connection before testing.');
    const origin = 'https://gateway.internal';
    const lease = await repo.reserve(row, secret, 'owner:test', origin);
    const realtime = config.protocol === 'qwen-realtime';
    const response = await this.invoke(
      new Request(`https://gateway.internal/invoke/${name}`, {
        method: realtime ? 'GET' : 'POST',
        headers: {
          'x-gemigo-ticket': lease.ticket,
          origin,
          ...(realtime ? { upgrade: 'websocket' } : {}),
        },
        body: realtime
          ? undefined
          : JSON.stringify(
              config.protocol === 'openai-chat'
                ? { messages: [{ role: 'user', content: 'Say OK.' }], max_tokens: 16 }
                : {}
            ),
      }),
      repo,
      name
    );
    if (!realtime) {
      await response.body?.cancel();
      return gatewayJson({ ok: true, protocol: config.protocol });
    }
    const ws = response.webSocket;
    ws.accept();
    return await new Promise((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        ws.close(1000);
        resolve(gatewayJson({ ok, protocol: config.protocol }, ok ? 200 : 502));
      };
      const timer = setTimeout(() => finish(false), 18000);
      ws.addEventListener('message', (event) => {
        try {
          const value = JSON.parse(String(event.data));
          if (value.type === 'session.created')
            ws.send(JSON.stringify({ type: 'session.update', session: {} }));
          if (value.type === 'session.updated') finish(true);
          if (value.type === 'error') finish(false);
        } catch {
          finish(false);
        }
      });
      ws.addEventListener('close', () => finish(false));
      ws.addEventListener('error', () => finish(false));
    });
  }
}
