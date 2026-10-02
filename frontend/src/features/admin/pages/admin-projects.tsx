import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Trash2, RotateCcw, Loader2, Search } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import {
  adminDeleteProject,
  adminRestoreProject,
  fetchAdminProjects,
} from '@/services/http/admin-api';
import type { Project } from '@/types';

export const AdminProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isLoadingAuth = useAuthStore((s) => s.isLoading);

  const [projects, setProjects] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminProjects({
        search: search.trim() || undefined,
        page,
        pageSize,
        includeDeleted,
      });
      setProjects(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load admin projects', err);
      setError(t('adminProjects.loadError', 'Failed to load projects'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.isAdmin, page, pageSize, includeDeleted]);

  const handleDelete = async (project: Project) => {
    if (!window.confirm(t('adminProjects.deleteConfirm'))) return;
    try {
      await adminDeleteProject(project.id);
      await loadProjects();
    } catch (err) {
      console.error('Delete failed', err);
      setError(t('adminProjects.deleteError', 'Failed to delete project'));
    }
  };

  const handleRestore = async (project: Project) => {
    try {
      await adminRestoreProject(project.id);
      await loadProjects();
    } catch (err) {
      console.error('Restore failed', err);
      setError(t('adminProjects.restoreError', 'Failed to restore project'));
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('common.loading')}
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <PageLayout title={t('adminProjects.title')}>
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Shield className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">{t('adminProjects.forbiddenTitle')}</p>
              <p className="text-sm text-amber-700">{t('adminProjects.forbiddenDesc')}</p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageLayout
      title={t('adminProjects.title')}
      actions={
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  void loadProjects();
                }
              }}
              placeholder={t('adminProjects.searchPlaceholder')}
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => {
                setIncludeDeleted(e.target.checked);
                setPage(1);
              }}
            />
            {t('adminProjects.showDeleted')}
          </label>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{t('adminProjects.name')}</th>
                <th className="px-4 py-3">{t('adminProjects.owner')}</th>
                <th className="px-4 py-3">{t('adminProjects.status')}</th>
                <th className="px-4 py-3">{t('adminProjects.lastDeployed')}</th>
                <th className="px-4 py-3 text-right">{t('adminProjects.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    {t('common.loading')}
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    {t('adminProjects.empty')}
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {project.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {project.name}
                      </div>
                      <div className="text-xs text-slate-500">{project.slug || project.repoUrl}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {project.ownerId || t('adminProjects.unknown')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {project.isDeleted ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-1 text-xs">
                          {t('adminProjects.deleted')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-1 text-xs">
                          {t('adminProjects.active')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {project.lastDeployed
                        ? new Date(project.lastDeployed).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {project.isDeleted ? (
                          <button
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                            onClick={() => handleRestore(project)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {t('adminProjects.restore')}
                          </button>
                        ) : (
                          <button
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(project)}
                          >
                            <Trash2 className="w-3 h-3" />
                            {t('adminProjects.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <div>
            {t('adminProjects.pagination', {
              page,
              totalPages,
              total,
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {t('adminProjects.prev')}
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {t('adminProjects.next')}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};
