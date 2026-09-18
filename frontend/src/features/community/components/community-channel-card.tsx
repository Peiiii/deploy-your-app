import { ArrowUpRight, MessageCircleMore, QrCode } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type CommunityChannel = 'wechat' | 'discord';

interface CommunityChannelCardProps {
  channel: CommunityChannel;
  href?: string | null;
  qrUrl?: string | null;
  primary?: boolean;
}

export const CommunityChannelCard: React.FC<CommunityChannelCardProps> = ({
  channel,
  href,
  qrUrl,
  primary = false,
}) => {
  const { t } = useTranslation();
  const [qrFailed, setQrFailed] = useState(false);
  const isWechat = channel === 'wechat';
  const isConfigured = isWechat ? Boolean(qrUrl && !qrFailed) : Boolean(href);

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition dark:bg-slate-900 md:p-7 ${primary
        ? 'border-brand-300 shadow-lg shadow-brand-500/10 dark:border-brand-500/40'
        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl ${isWechat ? 'bg-emerald-400/15' : 'bg-indigo-500/20'}`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${isWechat
            ? 'bg-emerald-500 shadow-emerald-500/20'
            : 'bg-indigo-600 shadow-indigo-500/20'
          }`}>
            {isWechat ? <MessageCircleMore className="h-6 w-6" /> : <span className="text-xl font-black">D</span>}
          </div>
          {primary && (
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              {t('community.channels.recommended')}
            </span>
          )}
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            {t(`community.channels.${channel}.region`)}
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {t(`community.channels.${channel}.title`)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t(`community.channels.${channel}.description`)}
          </p>
        </div>

        {isWechat ? (
          <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            {isConfigured ? (
              <>
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <img
                    src={qrUrl ?? ''}
                    alt={t('community.channels.wechat.qrAlt')}
                    onError={() => setQrFailed(true)}
                    className="h-36 w-36 object-contain md:h-40 md:w-40"
                  />
                </div>
                <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {t('community.channels.wechat.action')}
                </p>
              </>
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center text-center">
                <QrCode className="h-10 w-10 text-emerald-400" />
                <p className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {t('community.channels.unavailable')}
                </p>
                <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/60">
                  {t('community.channels.wechat.unavailableHint')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 flex flex-1 flex-col justify-end rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-500/15">
            <p className="text-sm leading-6 text-indigo-100">
              {t('community.channels.discord.value')}
            </p>
            {isConfigured ? (
              <a
                href={href ?? undefined}
                target="_blank"
                rel="noreferrer"
                data-event="community_join_click"
                data-channel="discord"
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t('community.channels.discord.action')}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : (
              <div className="mt-6 flex min-h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-indigo-100">
                {t('community.channels.unavailable')}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
