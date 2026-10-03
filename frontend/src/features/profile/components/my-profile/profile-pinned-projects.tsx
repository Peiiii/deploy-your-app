import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, PinOff } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { useMyProfileStore } from '@/features/profile/stores/my-profile.store';
import { usePresenter } from '@/contexts/presenter-context';
import { CreatorProjectCard } from '@/features/profile/components/creator-project-card';

export function ProfilePinnedProjects() {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const { pinnedIds, draggingPinnedId, actions } = useMyProfileStore();
  const projects = presenter.myProfile.getMyProjects();
  const pinned = pinnedIds
    .map((id) => projects.find((project) => project.id === id))
    .filter((project) => !!project);
  if (!pinned.length) return null;
  const move = (index: number, offset: number) => {
    const ids = pinnedIds.slice();
    const current = ids.indexOf(pinned[index].id);
    const target = ids.indexOf(pinned[index + offset].id);
    [ids[current], ids[target]] = [ids[target], ids[current]];
    actions.setPinnedIds(ids);
  };
  const dragOver = (event: DragEvent, id: string) => {
    if (draggingPinnedId && draggingPinnedId !== id) event.preventDefault();
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('profile.pinnedAppsDescription')}
      </p>
      <div className="creator-grid">
        {pinned.map((project, index) => (
          <div
            key={project.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', project.id);
              presenter.myProfile.handlePinnedDragStart(project.id);
            }}
            onDragOver={(event) => dragOver(event, project.id)}
            onDrop={(event) => {
              event.preventDefault();
              presenter.myProfile.handlePinnedDrop(project.id);
            }}
            onDragEnd={presenter.myProfile.handlePinnedDragEnd}
            className={draggingPinnedId === project.id ? 'opacity-50' : ''}
          >
            <CreatorProjectCard
              project={project}
              pinned
              priority={index < 3}
              actions={
                <>
                  <IconButton
                    label={t('profile.moveLinkUp')}
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="text-slate-400 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={t('profile.moveLinkDown')}
                    size="sm"
                    disabled={index === pinned.length - 1}
                    onClick={() => move(index, 1)}
                    className="text-slate-400 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={t('navigation.unpinProject')}
                    size="sm"
                    onClick={() => actions.togglePinned(project.id)}
                    className="text-brand-500"
                  >
                    <PinOff className="h-4 w-4" />
                  </IconButton>
                </>
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
