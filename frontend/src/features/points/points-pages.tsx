import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { Link, useSearchParams } from 'react-router-dom';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { PointsModel, type Wallet, type AuthorPoints, type Confirmation } from './points-model';

const button = 'rounded-lg bg-brand-600 px-4 py-2 text-white disabled:opacity-50';
const input = 'w-full rounded-lg border border-app-border bg-app-bg px-3 py-2';
function useModel<T>(path: string) {
  const model = useMemo(() => new PointsModel<T>(path), [path]);
  const state = useStore(model.store);
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (user) void model.load();
  }, [model, user]);
  return { model, ...state, user };
}
function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-red-500">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-green-500/10 p-3">
          {notice}
        </p>
      )}
    </>
  );
}
function Login() {
  const presenter = usePresenter();
  return (
    <button className={button} onClick={() => presenter.auth.openAuthModal('login')}>
      登录 GemiGo
    </button>
  );
}
function Money({
  sale,
}: {
  sale: { paid_minor: number; currency: string; creator_minor?: number };
}) {
  return (
    <span>
      {sale.paid_minor
        ? `${((sale.creator_minor ?? sale.paid_minor) / 100).toFixed(2)} ${sale.currency}`
        : '体验点消费 · 无现金收益'}
    </span>
  );
}

export function WalletPage() {
  const { model, data, loading, busy, error, notice, user } = useModel<Wallet>('/wallet');
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">我的点数</h1>
        <p className="mt-2 text-app-muted">
          一个钱包，用于各个 GemiGo 应用。具体消费由应用发起，并由你确认。
        </p>
      </div>
      {!user ? (
        <Login />
      ) : (
        <>
          <Feedback error={error} notice={notice} />
          {loading && !data && <p role="status">正在读取钱包…</p>}
          {data && (
            <>
              <section className="rounded-xl border border-app-border p-6">
                <p>可用点数</p>
                <p className="my-2 text-4xl font-semibold">{data.balance}</p>
                <p className="text-sm text-app-muted">
                  其中体验点 {data.trial}，无现金价值，不产生作者可提现收入。
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void model.action('/claim', {}, '体验点已领取；同一账号只可领取一次。')
                    }
                  >
                    领取 {data.settings.trial_points} 体验点
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void model.action('/recharge', {}, '充值完成')}
                  >
                    真钱充值
                  </button>
                  <a className="px-3 py-2 underline" href="https://docs.gemigo.io/examples">
                    去示例应用使用
                  </a>
                </div>
                <p className="mt-3 text-sm text-app-muted">{data.paymentStatus}</p>
              </section>
              <section>
                <h2 className="mb-3 text-lg font-medium">点数来源</h2>
                {data.lots.length ? (
                  data.lots.map((lot) => (
                    <div
                      className="flex justify-between border-b border-app-border py-3"
                      key={lot.id}
                    >
                      <span>
                        {lot.kind === 'trial' ? '平台体验补贴' : '实付充值'} ·{' '}
                        {new Date(lot.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        剩余 {lot.remaining} / {lot.total}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-app-muted">还没有点数，先领取体验点。</p>
                )}
              </section>
              <section>
                <h2 className="mb-3 text-lg font-medium">消费记录</h2>
                {data.receipts.length ? (
                  data.receipts.map((sale) => (
                    <div className="space-y-1 border-b border-app-border py-3" key={sale.id}>
                      <div className="flex justify-between gap-3">
                        <span>
                          {sale.app_name} · {sale.name}
                        </span>
                        <span>{sale.price} 点</span>
                      </div>
                      <p className="text-sm text-app-muted">
                        {sale.status} · <Money sale={sale} />
                      </p>
                      {sale.error && <p>{sale.error}</p>}
                      {sale.app_url && (
                        <a className="text-brand-500 underline" href={sale.app_url}>
                          返回应用查看权益或结果
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-app-muted">暂时没有消费记录。</p>
                )}
              </section>
              <section>
                <h2 className="mb-3 text-lg font-medium">自动续费</h2>
                {data.subscriptions.length ? (
                  data.subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border py-3"
                    >
                      <p>
                        {sub.app_name} · {sub.name} ·{' '}
                        {sub.active
                          ? `下一次 ${new Date(sub.due_at).toLocaleString()}`
                          : '已停止续费'}
                      </p>
                      {!!sub.active && (
                        <button
                          disabled={busy}
                          className={button}
                          onClick={() =>
                            void model.action(
                              `/subscriptions/${sub.id}/cancel`,
                              {},
                              '已取消自动续费，已付权益继续有效。'
                            )
                          }
                        >
                          取消续费
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-app-muted">没有自动续费约定。</p>
                )}
              </section>
            </>
          )}
          {user.isAdmin && <PointsOperations />}
          {error && (
            <button className={button} onClick={() => void model.load()}>
              重新加载
            </button>
          )}
        </>
      )}
    </main>
  );
}

export function PointsConfirmPage() {
  const [params] = useSearchParams();
  const id = params.get('intent') || '';
  const { model, data, loading, busy, error, notice, user } = useModel<Confirmation>(
    `/intents/${encodeURIComponent(id)}`
  );
  const presenter = usePresenter();
  const [subscribe, setSubscribe] = useState(false);
  useEffect(() => {
    void presenter.auth.loadCurrentUser();
  }, [presenter.auth]);
  return (
    <main className="mx-auto max-w-lg space-y-5 p-6">
      <a href="https://gemigo.io" className="font-semibold">
        GemiGo
      </a>
      <h1 className="text-2xl font-semibold">确认点数消费</h1>
      <Feedback error={error} notice={notice} />
      {!user ? (
        <>
          <p>使用应用内同一个账号登录，消费由平台确认。</p>
          <Login />
        </>
      ) : (
        <>
          {loading && !data ? (
            <p>正在核对消费…</p>
          ) : (
            data && (
              <>
                <div className="space-y-3 rounded-xl border border-app-border p-5">
                  <p className="text-app-muted">{data.app.name}</p>
                  <h2 className="text-xl font-semibold">{data.item.name}</h2>
                  <p>{data.item.description}</p>
                  {data.serviceInput && <p>本次主题：{data.serviceInput.topic}</p>}
                  <p className="text-3xl font-semibold">{data.item.price} 点</p>
                  <p>
                    当前余额 {data.balance.balance} 点
                    {!data.receipt && (
                      <> · 消费后 {Math.max(0, data.balance.balance - data.item.price)} 点</>
                    )}
                  </p>
                  <p className="text-sm text-app-muted">
                    {data.item.type === 'durable'
                      ? '一次解锁，已拥有不重复扣点'
                      : data.item.type === 'term'
                        ? `有效 ${Math.round((data.item.period_seconds / 86400) * 100) / 100} 天；重复购买延长有效期`
                        : '每次独立购买'}
                    {data.item.delivery === 'ai' ? '；先预留点数，结果保存后结算' : ''}
                  </p>
                </div>
                {data.receipt ? (
                  <>
                    <p role="status">
                      交易状态：{data.receipt.status}
                      。交易记录已保存，可以返回应用查询进度、权益或结果。
                    </p>
                    <a className={button} href={data.intent.origin}>
                      返回应用
                    </a>
                    <button className="px-3 py-2 underline" onClick={() => window.close()}>
                      关闭窗口
                    </button>
                  </>
                ) : data.expired ? (
                  <p>此次消费已过期，请回应用重新发起。</p>
                ) : (
                  <>
                    {data.item.type === 'term' && (
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={subscribe}
                          onChange={(e) => setSubscribe(e.target.checked)}
                        />
                        <span>
                          授权每 {Math.round((data.item.period_seconds / 86400) * 100) / 100} 天以{' '}
                          {data.item.price} 点自动续费。余额不足停止，不追扣错过周期；可在钱包取消。
                        </span>
                      </label>
                    )}
                    {data.balance.balance < data.item.price ? (
                      <p>
                        点数不足。
                        <Link className="underline" to="/wallet" target="_blank">
                          打开钱包领取或充值
                        </Link>
                        ，完成后{' '}
                        <button className="underline" onClick={() => void model.load()}>
                          刷新余额
                        </button>
                        ，再确认此消费。
                      </p>
                    ) : (
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => void model.confirm(subscribe)}
                      >
                        {busy ? '正在提交…' : `确认消费 ${data.item.price} 点`}
                      </button>
                    )}
                    <button
                      className="ml-3 underline"
                      onClick={() => {
                        window.close();
                      }}
                    >
                      取消
                    </button>
                  </>
                )}
              </>
            )
          )}
          {error && (
            <button className={button} onClick={() => void model.load()}>
              重试
            </button>
          )}
        </>
      )}
    </main>
  );
}

export function AuthorPointsTab({ projectId }: { projectId: string }) {
  const { model, data, loading, busy, error, notice } = useModel<AuthorPoints>(
    `/projects/${projectId}`
  );
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'repeatable',
    price: '2',
    entitlement: 'hint',
    units: '1',
    days: '30',
    delivery: 'grant',
  });
  const change = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">点数与收益</h2>
      <p className="text-app-muted">
        收费项定义价值，应用代码决定触发位置。
        <a
          href="https://docs.gemigo.io/points"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          查看 SDK 教程与接入 Skill
        </a>
      </p>
      <Feedback error={error} notice={notice} />
      {loading && !data && <p>正在读取收费项…</p>}
      <form
        className="grid gap-3 rounded-xl border border-app-border p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void model.action(
            `/projects/${projectId}/items`,
            {
              ...form,
              delivery: form.type === 'repeatable' ? form.delivery : 'grant',
              price: Number(form.price),
              units: Number(form.units),
              periodSeconds: Number(form.days) * 86400,
            },
            '收费项已创建，复制 SDK 调用接入应用。'
          );
        }}
      >
        <label>
          名称
          <input
            required
            maxLength={80}
            className={input}
            value={form.name}
            onChange={(e) => change('name', e.target.value)}
          />
        </label>
        <label>
          权益键
          <input
            required
            pattern="[a-z0-9_-]+"
            className={input}
            value={form.entitlement}
            onChange={(e) => change('entitlement', e.target.value)}
          />
        </label>
        <label className="md:col-span-2">
          用户可见说明
          <input
            required
            maxLength={300}
            className={input}
            value={form.description}
            onChange={(e) => change('description', e.target.value)}
          />
        </label>
        <label>
          消费类型
          <select
            className={input}
            value={form.type}
            onChange={(e) => change('type', e.target.value)}
          >
            <option value="repeatable">按次 / 道具额度</option>
            <option value="durable">一次解锁</option>
            <option value="term">按期权益 / 可授权续费</option>
          </select>
        </label>
        <label>
          点数价格
          <input
            className={input}
            required
            type="number"
            min="1"
            max="100000"
            value={form.price}
            onChange={(e) => change('price', e.target.value)}
          />
        </label>
        {form.type === 'repeatable' && (
          <>
            <label>
              交付
              <select
                className={input}
                value={form.delivery}
                onChange={(e) => change('delivery', e.target.value)}
              >
                <option value="grant">应用内额度</option>
                <option value="ai">平台知识 AI 解说</option>
              </select>
            </label>
            <label>
              每次授予额度
              <input
                className={input}
                type="number"
                min="1"
                max="10000"
                value={form.units}
                onChange={(e) => change('units', e.target.value)}
              />
            </label>
          </>
        )}
        {form.type === 'term' && (
          <label>
            有效天数
            <input
              className={input}
              type="number"
              min="1"
              max="365"
              value={form.days}
              onChange={(e) => change('days', e.target.value)}
            />
          </label>
        )}
        <button className={button} disabled={busy}>
          创建收费项
        </button>
        <p className="text-sm text-app-muted">价格创建后固定。调价请新建收费项并停用旧项。</p>
      </form>
      {data?.items.map((item) => (
        <div key={item.id} className="space-y-3 rounded-xl border border-app-border p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <p>
              {item.name} · {item.price} 点 · {item.type}
            </p>
            <button
              className="underline"
              disabled={busy}
              onClick={() =>
                void model.action(
                  `/items/${item.id}`,
                  { enabled: !item.enabled },
                  item.enabled ? '已停用' : '已启用',
                  'PATCH'
                )
              }
            >
              {item.enabled ? '停用' : '启用'}
            </button>
          </div>
          <p>{item.description}</p>
          <pre className="overflow-auto rounded bg-black/10 p-3 text-sm">{`await gemigo.points.purchase({\n  itemId: '${item.id}',\n  requestId: crypto.randomUUID(),${item.delivery === 'ai' ? "\n  topic: '为什么天空是蓝色的？'," : ''}\n});\n// 同一次消费和网络恢复请复用 requestId`}</pre>
          <button className="underline" onClick={() => void navigator.clipboard.writeText(item.id)}>
            复制收费项 ID
          </button>
        </div>
      ))}
      <section>
        <h3 className="text-lg font-semibold">消费与作者收益</h3>
        <p className="my-2 text-sm text-app-muted">
          真钱充值与结算尚未启用。体验点消费可以验证实际权益，不产生可提现收入。
        </p>
        {data?.sales.map((sale) => (
          <div
            key={sale.id}
            className="flex flex-wrap justify-between gap-3 border-b border-app-border py-3"
          >
            <p>
              {sale.name} · {sale.price} 点 · {sale.status}
              <br />
              <Money sale={sale} />
            </p>
            {sale.status === 'granted' && (
              <button
                disabled={busy}
                className="underline"
                onClick={() =>
                  void model.action(
                    `/receipts/${sale.id}/refund`,
                    {},
                    '已退款到原点数来源并回冲权益/收入。'
                  )
                }
              >
                退款未使用权益
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function PointsOperations() {
  const { model, data, busy, error, notice } = useModel<{
    settings: {
      trial_points: number;
      trial_budget: number;
      trial_issued: number;
      ai_daily_limit: number;
    };
    pending: {
      id: string;
      request_id: string;
      status: string;
      error: string;
      name: string;
      app_name: string;
    }[];
  }>('/operations');
  return (
    <section className="space-y-3 rounded-xl border border-app-border p-5">
      <h2 className="text-lg font-medium">平台点数管理</h2>
      <Feedback error={error} notice={notice} />
      {data && (
        <>
          <p>
            已发补贴 {data.settings.trial_issued} / {data.settings.trial_budget} 点 · AI 每日上限{' '}
            {data.settings.ai_daily_limit} 次
          </p>
          <form
            key={JSON.stringify(data.settings)}
            className="grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void model.action(
                '/settings',
                {
                  trialPoints: Number(form.get('trialPoints')),
                  trialBudget: Number(form.get('trialBudget')),
                  aiDailyLimit: Number(form.get('aiDailyLimit')),
                },
                '补贴配置已更新。'
              );
            }}
          >
            <label>
              每账号体验点
              <input
                className={input}
                name="trialPoints"
                type="number"
                min="0"
                max="1000"
                required
                defaultValue={data.settings.trial_points}
              />
            </label>
            <label>
              累计体验点预算
              <input
                className={input}
                name="trialBudget"
                type="number"
                min={data.settings.trial_issued}
                max="1000000"
                required
                defaultValue={data.settings.trial_budget}
              />
            </label>
            <label>
              AI 每日调用上限
              <input
                className={input}
                name="aiDailyLimit"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={data.settings.ai_daily_limit}
              />
            </label>
            <button className={button} disabled={busy}>
              保存补贴规则
            </button>
          </form>
          <p className="text-sm text-app-muted">
            待核查服务不会自动重跑。核实未交付后可释放回原点数来源；运行中的服务不能释放。
          </p>
          {data.pending.map((r) => (
            <div className="border-b border-app-border py-3" key={r.id}>
              <p>
                {r.app_name} · {r.name} · {r.status}
              </p>
              <p className="break-all text-sm">
                请求 {r.request_id} · 收据 {r.id} · {r.error}
              </p>
              {r.status !== 'running' && (
                <button
                  className="underline"
                  disabled={busy}
                  onClick={() =>
                    void model.action(`/receipts/${r.id}/release`, {}, '已释放回原点数来源。')
                  }
                >
                  核实未交付，释放点数
                </button>
              )}
            </div>
          ))}
          <button className="underline" onClick={() => void model.load()}>
            刷新待核查服务
          </button>
        </>
      )}
    </section>
  );
}
