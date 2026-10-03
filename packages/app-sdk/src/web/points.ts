import type { PointsAPI, PointsPurchaseResult, PointsReceipt } from '../types/points';
import { SDKError } from '../types/common';
import { webAuth, getWebApiBaseUrl } from './auth';

async function request<T>(path: string, body?: unknown): Promise<T> {
  const token = webAuth.getAccessToken();
  if (!token)
    throw new SDKError(
      'PERMISSION_DENIED',
      '请调用 gemigo.auth.login({scopes:["identity:basic","points:use"]})'
    );
  const response = await fetch(`${getWebApiBaseUrl().replace(/\/+$/, '')}/sdk/points${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new Error(`${data.code || response.status}: ${data.error || '点数请求失败'}`);
  }
  return response.json() as Promise<T>;
}
export const webPoints: PointsAPI = {
  items: () => request('/items'),
  grants: () => request('/grants'),
  consume: (input) => request('/consume', input),
  receipt: (input) => request(`/receipt?${new URLSearchParams(input)}`),
  async purchase(input) {
    if (typeof window === 'undefined')
      throw new SDKError('NOT_SUPPORTED', '点数消费需要托管浏览器应用。');
    // Preserve user activation before any network/crypto await.
    const popup = window.open('about:blank', 'gemigo_points', 'popup=yes,width=520,height=760');
    try {
      const intent = await request<{ id: string; state: string }>('/intents', {
        ...input,
        state: crypto.randomUUID(),
      });
      const platformOrigin = new URL(getWebApiBaseUrl()).origin;
      const confirm = new URL('/points/confirm', platformOrigin);
      confirm.searchParams.set('intent', intent.id);
      const saved = await webPoints.receipt({ requestId: input.requestId });
      if (saved) {
        popup?.close();
        return saved;
      }
      if (!popup)
        return {
          status: 'pending',
          requestId: input.requestId,
          confirmationUrl: confirm.toString(),
        };
      const result = await new Promise<PointsPurchaseResult>((resolve, reject) => {
        let finished = false;
        const cleanup = () => {
          window.removeEventListener('message', onMessage);
          window.clearTimeout(timer);
          window.clearInterval(closed);
        };
        const recover = async () => {
          if (finished) return;
          finished = true;
          cleanup();
          try {
            resolve(
              (await webPoints.receipt({ requestId: input.requestId })) || {
                status: 'cancelled',
                requestId: input.requestId,
              }
            );
          } catch (error) {
            reject(error);
          }
        };
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== platformOrigin || event.source !== popup) return;
          const data = event.data as { type?: string; state?: string; intentId?: string };
          if (
            data?.type !== 'gemigo:points-result' ||
            data.state !== intent.state ||
            data.intentId !== intent.id
          )
            return;
          void recover();
        };
        const timer = window.setTimeout(() => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve({
            status: 'pending',
            requestId: input.requestId,
            confirmationUrl: confirm.toString(),
          });
        }, 120000);
        const closed = window.setInterval(() => {
          if (popup.closed) void recover();
        }, 700);
        window.addEventListener('message', onMessage);
        popup.location.href = confirm.toString();
      });
      return result;
    } catch (error) {
      popup?.close();
      throw error;
    }
  },
};
