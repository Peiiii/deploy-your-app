import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import type { DeploymentDiagnostic } from '@/services/interfaces';

export function DeploymentResult({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const [result, setResult] = useState<DeploymentDiagnostic | null>();
  const [loading, setLoading] = useState(false);
  const inspect = async () => {
    setLoading(true);
    try {
      setResult(await presenter.project.getLatestDeployment(projectId));
    } catch {
      presenter.ui.showErrorToast(t('deployment.resultLoadFailed'));
    } finally {
      setLoading(false);
    }
  };
  const failed = result?.status === 'failed' || result?.status === 'rejected';
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={() => void inspect()}
        className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
      >
        {loading ? t('common.loading') : t('deployment.latestResult')}
      </button>
      {result === null && (
        <p className="text-sm text-slate-500">{t('deployment.noRecordedResult')}</p>
      )}
      {result && (
        <div
          className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
          role="status"
        >
          <p className="font-medium">
            {t(
              failed
                ? 'deployment.deploymentFailedTitle'
                : result.status === 'succeeded'
                  ? 'deployment.successful'
                  : 'deployment.building'
            )}
          </p>
          <p className="text-sm text-slate-500">
            {result.buildMode && t(`deployment.modes.${result.buildMode}`)}
            {result.stage &&
              ` · ${t(`deployment.stages.${result.stage}`, { defaultValue: result.stage })}`}
          </p>
          {failed && (
            <pre className="text-sm whitespace-pre-wrap break-words text-red-600 dark:text-red-400">
              {result.errorCode
                ? t(`deployment.errors.${result.errorCode}`, {
                    defaultValue: result.errorMessage || t('deployment.noDetailedError'),
                  })
                : result.errorMessage || t('deployment.noDetailedError')}
            </pre>
          )}
          <p className="text-xs text-slate-500">
            {new Date(result.finishedAt || result.startedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
