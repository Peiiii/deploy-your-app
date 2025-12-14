import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

export interface ErrorEnvelope {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

export function errorResponse(status: number, message: string): Response {
  const body: ErrorEnvelope = {
    error: { code: status, message, status: 'ERROR' },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type AppEnv<Bindings extends object> = { Bindings: Bindings };

export type WorkerApp<Bindings extends object> = Hono<AppEnv<Bindings>> & {
  getWorker(): ExportedHandler<Bindings>;
};

export function createWorkerApp<Bindings extends object>(opts?: {
  cors?: false | Parameters<typeof cors>[0];
  middleware?: MiddlewareHandler<AppEnv<Bindings>>[];
  onError?: (error: unknown) => Response;
  notFound?: () => Response;
}): WorkerApp<Bindings> {
  const app = new Hono<AppEnv<Bindings>>();

  // Project-wide middleware hooks.
  (opts?.middleware ?? []).forEach((mw) => app.use('*', mw));

  // CORS is enabled by default (common for API + browser-based clients).
  if (opts?.cors !== false) {
    app.use(
      '*',
      cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'x-goog-api-key'],
        ...opts?.cors,
      }),
    );
  }

  // Standard error envelope (override-able).
  app.notFound(() => opts?.notFound?.() ?? errorResponse(404, 'Not Found'));

  app.onError((err) => {
    console.error('Worker error:', err);
    if (opts?.onError) {
      return opts.onError(err);
    }
    return errorResponse(500, err instanceof Error ? err.message : 'Internal error');
  });

  const worker = {
    fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
      return app.fetch(request, env, ctx);
    },
  } satisfies ExportedHandler<Bindings>;

  (app as WorkerApp<Bindings>).getWorker = () => worker;

  return app as WorkerApp<Bindings>;
}
