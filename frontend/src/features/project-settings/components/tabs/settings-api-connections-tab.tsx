import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '@/types';
import type { ApiConnection } from '@/services/http/api-connections-api';
import { useApiConnectionsStore } from '../../stores/api-connections.store';
import { APP_CONFIG } from '@/constants';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';
const buttonClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700';
function initialConnection(): ApiConnection {
  return {
    name: '',
    protocol: 'openai-chat',
    baseUrl: 'https://api.openai.com/v1',
    secretName: '',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    access: 'login',
    enabled: true,
    models: [],
    method: 'POST',
    path: '/',
    limits: {
      userDaily: 20,
      appDaily: 200,
      concurrency: 4,
      userConcurrency: 1,
      durationSeconds: 60,
      outputTokens: 1024,
    },
  };
}

export function SettingsApiConnectionsTab({ project }: { project: Project }) {
  const { t } = useTranslation();
  const state = useApiConnectionsStore();
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [draft, setDraft] = useState<ApiConnection>(initialConnection);
  const [editing, setEditing] = useState(false);
  const [modelsText, setModelsText] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    void useApiConnectionsStore.getState().load(project.id);
  }, [project.id]);
  const settings = state.projectId === project.id ? state.settings : null;
  const update = <K extends keyof ApiConnection>(field: K, value: ApiConnection[K]) =>
    setDraft((d) => ({ ...d, [field]: value }));
  const apiBase = new URL(APP_CONFIG.API_BASE_URL, window.location.origin).href.replace(/\/+$/, '');
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">{t('apiConnections.title')}</h2>
        <p className="mt-2 text-sm text-slate-500">{t('apiConnections.description')}</p>
      </div>
      {state.loading && <p role="status">{t('common.loading')}</p>}
      {state.error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950">
          <p>{state.error}</p>
          <button className={buttonClass} onClick={() => void state.load(project.id)}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {state.notice && (
        <p role="status" className="text-sm text-emerald-700">
          {t(`apiConnections.${state.notice}`)}
        </p>
      )}
      {settings && (
        <>
          <section className="space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
            <h3 className="font-semibold">Secrets</h3>
            <p className="text-sm text-slate-500">{t('apiConnections.secretHelp')}</p>
            {settings.secrets.map((secret) => (
              <div key={secret.name} className="flex flex-wrap items-center gap-3 text-sm">
                <code>{secret.name}</code>
                <span>{t('apiConnections.version', { version: secret.version })}</span>
                <button
                  disabled={state.busy}
                  className={buttonClass}
                  onClick={() => {
                    setSecretName(secret.name);
                    setSecretValue('');
                  }}
                >
                  {t('apiConnections.replace')}
                </button>
                <button
                  disabled={state.busy}
                  className={buttonClass}
                  onClick={() => {
                    if (window.confirm(t('apiConnections.deleteConfirm', { name: secret.name })))
                      void state.deleteSecret(secret.name);
                  }}
                >
                  {t('apiConnections.remove')}
                </button>
              </div>
            ))}
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await state.saveSecret(secretName, secretValue)) {
                  setSecretValue('');
                  setSecretName('');
                }
              }}
            >
              <label className="text-sm">
                {t('apiConnections.secretName')}
                <input
                  className={inputClass}
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  required
                  pattern="[A-Za-z][A-Za-z0-9_-]{0,63}"
                  maxLength={64}
                  placeholder="MODEL_KEY"
                />
              </label>
              <label className="text-sm">
                {t('apiConnections.secretValue')}
                <input
                  className={inputClass}
                  type="password"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  required
                  autoComplete="new-password"
                  maxLength={16384}
                  data-sensitive="true"
                />
              </label>
              <button className={`${buttonClass} self-end`} disabled={state.busy} type="submit">
                {t('apiConnections.saveSecret')}
              </button>
            </form>
          </section>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{t('apiConnections.connections')}</h3>
              <button
                className={buttonClass}
                onClick={() => {
                  setDraft(initialConnection());
                  setModelsText('');
                  setEditing(false);
                }}
              >
                {t('apiConnections.new')}
              </button>
            </div>
            <p className="text-sm text-slate-500">{t('apiConnections.usage', settings.usage)}</p>
            {settings.connections.length === 0 && (
              <p className="text-sm text-slate-500">{t('apiConnections.empty')}</p>
            )}
            {settings.connections.map((connection) => (
              <article
                key={connection.name}
                className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <strong>{connection.name}</strong>
                  <span className="text-sm text-slate-500">
                    {connection.protocol} ·{' '}
                    {t(connection.enabled ? 'apiConnections.enabled' : 'apiConnections.disabled')} ·{' '}
                    {t(`apiConnections.${connection.access}`)}
                  </span>
                </div>
                <p className="break-all text-sm text-slate-500">{connection.baseUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={state.busy}
                    className={buttonClass}
                    onClick={() => {
                      setDraft(connection);
                      setModelsText(connection.models.join(', '));
                      setEditing(true);
                    }}
                  >
                    {t('apiConnections.edit')}
                  </button>
                  <button
                    disabled={state.busy || !connection.enabled}
                    className={buttonClass}
                    onClick={() => void state.test(connection.name)}
                  >
                    {t('apiConnections.test')}
                  </button>
                  <button
                    disabled={state.busy}
                    className={buttonClass}
                    onClick={() =>
                      void state.saveConnection({ ...connection, enabled: !connection.enabled })
                    }
                  >
                    {t(connection.enabled ? 'apiConnections.disable' : 'apiConnections.enable')}
                  </button>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm">
                    {t('apiConnections.integration')}
                  </summary>
                  <p className="my-2 text-sm text-slate-500">
                    {t('apiConnections.ticketHelp')}{' '}
                    <a
                      className="underline"
                      href="https://docs.gemigo.io/api-connections"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('apiConnections.integration')}
                    </a>
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-950">{`// ${connection.access === 'login' ? 'Authorization: Bearer <GemiGo app access token>' : 'Public mode: no upstream key in the browser'}\nPOST ${apiBase}/apps/${project.id}/connections/${connection.name}/tickets\n\n${connection.protocol === 'qwen-realtime' ? 'WebSocket(ticket.websocketUrl + "?ticket=" + ticket.ticket)' : 'POST ticket.httpUrl\nX-Gemigo-Ticket: <ticket.ticket>\nContent-Type: application/json'}`}</pre>
                  <button
                    className={buttonClass}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${apiBase}/apps/${project.id}/connections/${connection.name}/tickets`
                        );
                        setCopied(connection.name);
                      } catch {
                        setCopied(null);
                      }
                    }}
                  >
                    {t(
                      copied === connection.name ? 'apiConnections.copied' : 'apiConnections.copy'
                    )}
                  </button>
                </details>
              </article>
            ))}
          </section>
          <form
            className="space-y-4 rounded-xl border border-slate-200 p-5 dark:border-slate-800"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await state.saveConnection(draft)) setEditing(true);
            }}
          >
            <h3 className="font-semibold">
              {t(editing ? 'apiConnections.edit' : 'apiConnections.new')}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                {t('apiConnections.name')}
                <input
                  className={inputClass}
                  value={draft.name}
                  readOnly={editing}
                  onChange={(e) => update('name', e.target.value)}
                  pattern="[A-Za-z][A-Za-z0-9_-]{0,63}"
                  maxLength={64}
                  required
                />
              </label>
              <label className="text-sm">
                {t('apiConnections.protocol')}
                <select
                  className={inputClass}
                  value={draft.protocol}
                  onChange={(e) => {
                    const protocol = e.target.value as ApiConnection['protocol'];
                    setModelsText(protocol === 'qwen-realtime' ? 'qwen3-omni-flash-realtime' : '');
                    setDraft((d) => ({
                      ...d,
                      protocol,
                      baseUrl:
                        protocol === 'qwen-realtime'
                          ? 'https://dashscope.aliyuncs.com/api-ws/v1/realtime'
                          : protocol === 'openai-chat'
                            ? 'https://api.openai.com/v1'
                            : '',
                      models: protocol === 'qwen-realtime' ? ['qwen3-omni-flash-realtime'] : [],
                      limits: {
                        ...d.limits,
                        durationSeconds: protocol === 'qwen-realtime' ? 300 : 60,
                      },
                    }));
                  }}
                >
                  <option value="openai-chat">OpenAI Chat Completions / SSE</option>
                  <option value="qwen-realtime">Qwen Realtime / WebSocket</option>
                  <option value="http">HTTP JSON / text / SSE</option>
                </select>
              </label>
              <label className="text-sm">
                {t('apiConnections.url')}
                <input
                  className={inputClass}
                  type="url"
                  value={draft.baseUrl}
                  onChange={(e) => update('baseUrl', e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                Secret
                <select
                  className={inputClass}
                  value={draft.secretName}
                  onChange={(e) => update('secretName', e.target.value)}
                  required
                >
                  <option value="">{t('apiConnections.selectSecret')}</option>
                  {settings.secrets.map((secret) => (
                    <option key={secret.name}>{secret.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t('apiConnections.header')}
                <input
                  className={inputClass}
                  value={draft.authHeader}
                  onChange={(e) => update('authHeader', e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                {t('apiConnections.prefix')}
                <input
                  className={inputClass}
                  value={draft.authPrefix}
                  onChange={(e) => update('authPrefix', e.target.value)}
                />
              </label>
              <label className="text-sm">
                {t('apiConnections.access')}
                <select
                  className={inputClass}
                  value={draft.access}
                  onChange={(e) => update('access', e.target.value as ApiConnection['access'])}
                >
                  <option value="login">{t('apiConnections.login')}</option>
                  <option value="public">{t('apiConnections.public')}</option>
                </select>
              </label>
              {draft.protocol !== 'http' && (
                <label className="text-sm">
                  {t('apiConnections.models')}
                  <input
                    className={inputClass}
                    value={modelsText}
                    onChange={(e) => {
                      setModelsText(e.target.value);
                      update(
                        'models',
                        e.target.value
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean)
                      );
                    }}
                    required
                    placeholder={
                      draft.protocol === 'qwen-realtime'
                        ? 'qwen3-omni-flash-realtime'
                        : 'deepseek-flash'
                    }
                  />
                </label>
              )}
              {draft.protocol === 'http' && (
                <>
                  <label className="text-sm">
                    {t('apiConnections.method')}
                    <select
                      className={inputClass}
                      value={draft.method}
                      onChange={(e) => update('method', e.target.value as ApiConnection['method'])}
                    >
                      <option>POST</option>
                      <option>GET</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    {t('apiConnections.path')}
                    <input
                      className={inputClass}
                      value={draft.path}
                      onChange={(e) => update('path', e.target.value)}
                      required
                    />
                  </label>
                </>
              )}
              {(
                [
                  'userDaily',
                  'appDaily',
                  'concurrency',
                  'userConcurrency',
                  'durationSeconds',
                  'outputTokens',
                ] as const
              ).map((key) => (
                <label className="text-sm" key={key}>
                  {t(`apiConnections.${key}`)}
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={
                      key === 'userDaily'
                        ? 10000
                        : key === 'appDaily'
                          ? 100000
                          : key === 'concurrency'
                            ? 10
                            : key === 'userConcurrency'
                              ? 4
                              : key === 'outputTokens'
                                ? 8192
                                : draft.protocol === 'qwen-realtime'
                                  ? 600
                                  : 120
                    }
                    value={draft.limits[key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        limits: { ...d.limits, [key]: Number(e.target.value) },
                      }))
                    }
                    required
                  />
                </label>
              ))}
            </div>
            <p className="text-sm text-slate-500">{t('apiConnections.limitHelp')}</p>
            {draft.access === 'public' && (
              <p className="text-sm text-amber-700">{t('apiConnections.publicHelp')}</p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
              />
              {t('apiConnections.enabled')}
            </label>
            <button
              type="submit"
              className={`${buttonClass} bg-brand-600 text-white`}
              disabled={state.busy || !settings.secrets.length}
            >
              {state.busy ? t('common.loading') : t('apiConnections.saveConnection')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
