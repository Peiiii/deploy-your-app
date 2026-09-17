import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useProjectStore } from '../../stores/project.store';
import { usePresenter } from '../../contexts/presenter-context';
import { fetchMyProfile, updateMyProfile } from '../../services/http/profile-api';
import type { Project } from '../../types';

const parseLastDeployed = (value: Project['lastDeployed']) => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
};

export const useSidebarProjects = () => {
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const allProjects = useProjectStore((s) => s.projects);
  const projectsLoading = useProjectStore((s) => s.isLoading);
  const projectsLoaded = useProjectStore((s) => s.hasLoaded);
  const projectsLoadError = useProjectStore((s) => s.loadError);
  const presenter = usePresenter();
  
  const [profileProjects, setProfileProjects] = useState<{
    userId: string;
    pinnedProjectIds: string[];
  } | null>(null);

  const pinnedProjectIds = useMemo(
    () =>
      authUser && profileProjects?.userId === authUser.id
        ? profileProjects.pinnedProjectIds
        : [],
    [authUser, profileProjects],
  );

  const userProjects = useMemo(() => {
    if (!authUser) return [];
    return allProjects.filter((p) => p.ownerId === authUser.id);
  }, [allProjects, authUser]);

  const pinnedProjects = useMemo(() => {
    if (userProjects.length === 0) return [];
    const pinnedIds = pinnedProjectIds || [];
    const projects: Project[] = [];
    pinnedIds.forEach((id) => {
      const found = userProjects.find((p) => p.id === id);
      if (found) {
        projects.push(found);
      }
    });
    return projects;
  }, [userProjects, pinnedProjectIds]);

  const recentProjects = useMemo(() => {
    if (userProjects.length === 0) return [];
    return [...userProjects]
      .sort((a, b) => parseLastDeployed(b.lastDeployed) - parseLastDeployed(a.lastDeployed));
  }, [userProjects]);

  const displayedProjects = useMemo(() => {
    const MAX_COUNT = 5;
    const pinnedSlice = pinnedProjects.slice(0, MAX_COUNT);
    if (pinnedSlice.length >= MAX_COUNT) return pinnedSlice;

    const remaining = MAX_COUNT - pinnedSlice.length;
    const recentFill = recentProjects.filter((p) => !pinnedProjectIds.includes(p.id)).slice(0, remaining);

    return [...pinnedSlice, ...recentFill];
  }, [pinnedProjects, recentProjects, pinnedProjectIds]);

  useEffect(() => {
    if (!authUser) return;

    let active = true;
    void fetchMyProfile()
      .then((profile) => {
        if (!active) return;
        const ids = profile.pinnedProjectIds || [];
        setProfileProjects({ userId: authUser.id, pinnedProjectIds: ids });
      })
      .catch(() => {
        if (!active) return;
        setProfileProjects({ userId: authUser.id, pinnedProjectIds: [] });
      });

    return () => {
      active = false;
    };
  }, [authUser]);

  const handleTogglePin = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!authUser) return;
    
    const isUnpinning = pinnedProjectIds.includes(projectId);
    const newPinnedIds = isUnpinning
      ? pinnedProjectIds.filter((id) => id !== projectId)
      : [...pinnedProjectIds, projectId];
    
    setProfileProjects({
      userId: authUser.id,
      pinnedProjectIds: newPinnedIds,
    });

    try {
      await updateMyProfile({ pinnedProjectIds: newPinnedIds });
    } catch (error) {
      console.error('Failed to update pinned projects', error);
      setProfileProjects({
        userId: authUser.id,
        pinnedProjectIds,
      });
    }
  };

  const isLoadingProfile = Boolean(
    authUser && profileProjects?.userId !== authUser.id,
  );
  const isLoading =
    authLoading ||
    Boolean(
      authUser &&
        (isLoadingProfile ||
          (!projectsLoaded && !projectsLoadError) ||
          projectsLoading),
    );

  const retryProjects = () => {
    void presenter.project.loadProjects();
  };

  return {
    userProjects,
    pinnedProjects,
    recentProjects,
    displayedProjects,
    pinnedProjectIds,
    handleTogglePin,
    isLoading,
    hasLoadError: Boolean(projectsLoadError && allProjects.length === 0),
    retryProjects,
  };
};
