import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useProjectStore } from '../../stores/projectStore';
import { usePresenter } from '../../contexts/PresenterContext';
import { fetchMyProfile, updateMyProfile } from '../../services/http/profileApi';
import type { Project } from '../../types';

const parseLastDeployed = (value: Project['lastDeployed']) => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
};

export const useSidebarProjects = () => {
  const authUser = useAuthStore((s) => s.user);
  const allProjects = useProjectStore((s) => s.projects);
  const presenter = usePresenter();
  
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([]);
  const [projectViewType, setProjectViewType] = useState<'pinned' | 'recent'>('recent');

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
      return;
    }
    
    void fetchMyProfile()
      .then((profile) => {
        setPinnedProjectIds(profile.pinnedProjectIds || []);
      })
      .catch(() => {
        setPinnedProjectIds([]);
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
      setProjectViewType('recent');
    }
    
    try {
      await updateMyProfile({ pinnedProjectIds: newPinnedIds });
    } catch (error) {
      console.error('Failed to update pinned projects', error);
      setPinnedProjectIds(pinnedProjectIds);
    }
  };

  return {
    userProjects,
    pinnedProjects,
    recentProjects,
    displayedProjects,
    pinnedProjectIds,
    projectViewType,
    setProjectViewType,
    handleTogglePin,
  };
};
