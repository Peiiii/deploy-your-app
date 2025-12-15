import { useState, useEffect, useMemo, useRef } from 'react';
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
  const allProjects = useProjectStore((s) => s.projects);
  const projectsLoading = useProjectStore((s) => s.isLoading);
  const presenter = usePresenter();
  
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([]);
  const [projectViewType, setProjectViewTypeState] = useState<'pinned' | 'recent'>('recent');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const didInitDefaultViewRef = useRef(false);
  const userChangedViewRef = useRef(false);

  const setProjectViewType = (type: 'pinned' | 'recent') => {
    userChangedViewRef.current = true;
    setProjectViewTypeState(type);
  };

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
      .sort((a, b) => parseLastDeployed(b.lastDeployed) - parseLastDeployed(a.lastDeployed))
      .slice(0, 5);
  }, [userProjects]);

  const displayedProjects = useMemo(() => {
    if (projectViewType === 'pinned') {
      return pinnedProjects.slice(0, 5);
    }
    return recentProjects;
  }, [projectViewType, pinnedProjects, recentProjects]);

  useEffect(() => {
    if (!authUser) {
      didInitDefaultViewRef.current = false;
      userChangedViewRef.current = false;
      setPinnedProjectIds([]);
      setProjectViewTypeState('recent');
      setIsLoadingProfile(false);
      return;
    }
    
    setIsLoadingProfile(true);
    void fetchMyProfile()
      .then((profile) => {
        const ids = profile.pinnedProjectIds || [];
        setPinnedProjectIds(ids);

        if (!didInitDefaultViewRef.current && !userChangedViewRef.current) {
          didInitDefaultViewRef.current = true;
          setProjectViewTypeState(ids.length > 0 ? 'pinned' : 'recent');
        }
      })
      .catch(() => {
        setPinnedProjectIds([]);

        if (!didInitDefaultViewRef.current && !userChangedViewRef.current) {
          didInitDefaultViewRef.current = true;
          setProjectViewTypeState('recent');
        }
      })
      .finally(() => {
        setIsLoadingProfile(false);
      });
  }, [authUser]);

  useEffect(() => {
    if (authUser && allProjects.length === 0) {
      presenter.project.loadProjects();
    }
  }, [authUser, allProjects.length, presenter.project]);

  const handleTogglePin = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!authUser) return;
    
    const isUnpinning = pinnedProjectIds.includes(projectId);
    const newPinnedIds = isUnpinning
      ? pinnedProjectIds.filter((id) => id !== projectId)
      : [...pinnedProjectIds, projectId];
    
    setPinnedProjectIds(newPinnedIds);

    if (isUnpinning && newPinnedIds.length === 0 && projectViewType === 'pinned') {
      setProjectViewTypeState('recent');
    }
    
    try {
      await updateMyProfile({ pinnedProjectIds: newPinnedIds });
    } catch (error) {
      console.error('Failed to update pinned projects', error);
      setPinnedProjectIds(pinnedProjectIds);
    }
  };

  const isLoading = isLoadingProfile || (authUser && projectsLoading && allProjects.length === 0);

  return {
    userProjects,
    pinnedProjects,
    recentProjects,
    displayedProjects,
    pinnedProjectIds,
    projectViewType,
    setProjectViewType,
    handleTogglePin,
    isLoading,
  };
};
