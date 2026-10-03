import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useMyProfileStore } from '@/features/profile/stores/my-profile.store';
import { usePresenter } from '@/contexts/presenter-context';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CreatorHeader } from '@/features/profile/components/creator-header';
import { resolvePublicAuthorIdentity } from '@gemigo/public-author';

export function ProfileLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const draft = useMyProfileStore();
  const { copied, copyToClipboard } = useCopyToClipboard({
    onSuccess: () => presenter.ui.showSuccessToast(t('profile.profileLinkCopied')),
  });
  if (!user) return null;
  const displayName = draft.displayNameInput;
  const handle = draft.handleInput;
  return (
    <div className="creator-profile mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <CreatorHeader
        data={{
          user: { ...user, displayName, handle },
          publicAuthor: resolvePublicAuthorIdentity({ ownerId: user.id, displayName, handle }),
          profile: { bio: draft.bio, links: draft.links, pinnedProjectIds: draft.pinnedIds },
          stats: draft.profileData?.stats ?? {
            publicProjectsCount: 0,
            totalLikes: 0,
            totalFavorites: 0,
          },
        }}
        actions={
          <>
            <IconButton
              label={t('profile.viewPublicProfile')}
              variant="plain"
              size="auto"
              onClick={presenter.myProfile.openPublicProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <ExternalLink className="h-4 w-4" />
              <span>{t('profile.viewPublicProfile')}</span>
            </IconButton>
            <IconButton
              label={t(copied ? 'common.copied' : 'profile.copyProfileLink')}
              size="md"
              onClick={() => presenter.myProfile.copyPublicUrl(copyToClipboard)}
              className="border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </IconButton>
          </>
        }
      />
      {children}
    </div>
  );
}
