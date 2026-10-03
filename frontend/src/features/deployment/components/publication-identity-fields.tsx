import { useState } from 'react';
import { Globe2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { useDeploymentStore } from '../stores/deployment.store';
import { getPublicationSlug, isValidPublicationSlug } from '../managers/publication-details';
import type { usePublicationAddress } from '../hooks/use-publication-address';

export function PublicationIdentityFields({ address }: { address: ReturnType<typeof usePublicationAddress> }) {
  const { t } = useTranslation();
  const { deployment } = usePresenter();
  const state = useDeploymentStore();
  const [editing, setEditing] = useState(false);
  const slug = getPublicationSlug(state);
  const invalid = address.status === 'invalid';
  const taken = address.status === 'taken' || state.publicationAddressError === 'ADDRESS_TAKEN';
  const error = state.publicationAddressError;
  const feedback = error ? t(`deployment.addressErrors.${error}`) : t(`deployment.addressStatus.${address.status}`);
  const actionClass = 'shrink-0 rounded-md px-1 py-1 text-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300';

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="publication-name" className="block text-sm font-medium text-slate-900 dark:text-white">{t('deployment.optionalName')}</label>
        <input
          id="publication-name"
          value={state.projectName}
          onChange={(event) => deployment.setProjectName(event.target.value)}
          placeholder={t('deployment.optionalNameHint')}
          maxLength={80}
          aria-describedby="publication-name-hint"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-white dark:placeholder:text-slate-500"
        />
        <p id="publication-name-hint" className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('deployment.nameExplanation')}</p>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={editing ? 'publication-address' : undefined} className="text-sm font-medium text-slate-900 dark:text-white">{t('deployment.publicationAddress')}</label>
          <button type="button" className={actionClass} disabled={editing && !isValidPublicationSlug(slug)} onClick={() => {
            if (!editing) deployment.setPublicationSlug(slug);
            setEditing(!editing);
          }}>{t(editing ? 'deployment.finishAddressEdit' : 'deployment.editAddress')}</button>
        </div>
        <div className={`mt-2 flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 ${invalid || taken || error ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'} bg-slate-50/50 dark:bg-slate-800/30`}>
          <Globe2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
          {editing ? (
            <>
              <input id="publication-address" autoFocus value={slug} maxLength={63} spellCheck={false} autoCapitalize="none" autoComplete="off" aria-invalid={invalid || taken} aria-describedby="publication-address-status publication-address-hint" aria-label={t('deployment.addressPrefix')} onChange={(event) => deployment.setPublicationSlug(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-white" />
              <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">.{address.domain}</span>
            </>
          ) : <span className="min-w-0 break-all text-sm text-slate-700 dark:text-slate-200">https://{slug}.{address.domain}</span>}
        </div>
        <div id="publication-address-status" role="status" aria-live="polite" className={`mt-1.5 flex flex-wrap items-center gap-x-2 text-xs leading-5 ${invalid || taken || error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {address.status === 'checking' && <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />}
          <span>{feedback}</span>
          {taken && address.suggestion && <button type="button" className={`${actionClass} max-w-full break-all text-left`} onClick={() => deployment.setPublicationSlug(address.suggestion!)}>{t('deployment.useSuggestedAddress', { address: address.suggestion })}</button>}
          {address.status === 'error' && <button type="button" className={actionClass} onClick={address.retry}>{t('common.retry')}</button>}
          {editing && state.publicationSlug !== null && !state.newProjectId && <button type="button" className={actionClass} onClick={() => deployment.setPublicationSlug(null)}>{t('deployment.automaticAddress')}</button>}
        </div>
        <p id="publication-address-hint" className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('deployment.addressExplanation')}</p>
      </div>
    </div>
  );
}
