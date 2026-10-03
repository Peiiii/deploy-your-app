import { useEffect, useState } from 'react';
import { usePresenter } from '@/contexts/presenter-context';
import type { ProjectAddressAvailability } from '@/services/project-address';
import { isValidPublicationSlug } from '../managers/publication-details';

export function usePublicationAddress(slug: string, projectId: string | null, submissionError: string | null) {
  const { project } = usePresenter();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: ProjectAddressAvailability; failed?: boolean }>();
  const key = JSON.stringify([slug, projectId, attempt, submissionError]);
  const valid = isValidPublicationSlug(slug);
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void project.checkAddressAvailability(slug, projectId ?? undefined, controller.signal).then(
        (data) => { if (!controller.signal.aborted) setResult({ key, data }); },
        () => { if (!controller.signal.aborted) setResult({ key, failed: true }); }
      );
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [project, slug, projectId, key, valid]);
  const current = result?.key === key ? result : undefined;
  const status = !valid ? 'invalid' : current?.failed ? 'error' : !current?.data ? 'checking' : current.data.available ? 'available' : 'taken';
  return { status, domain: result?.data?.domain ?? 'gemigo.app', suggestion: current?.data?.suggestion, retry: () => setAttempt((value) => value + 1) };
}
