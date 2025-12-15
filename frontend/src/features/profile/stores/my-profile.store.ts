import { create } from 'zustand';
import type { PublicUserProfile, ProfileLink } from '@/types';

interface MyProfileState {
  // Profile data
  profileData: PublicUserProfile | null;

  // Form drafts
  bio: string;
  links: ProfileLink[];
  handleInput: string;
  pinnedIds: string[];

  // UI state
  handleError: string | null;
  draggingPinnedId: string | null;
  isLoading: boolean;
  isSaving: boolean;

  actions: {
    setProfileData: (data: PublicUserProfile | null) => void;
    setBio: (bio: string) => void;
    setLinks: (links: ProfileLink[]) => void;
    setHandleInput: (value: string) => void;
    setPinnedIds: (ids: string[]) => void;
    setHandleError: (error: string | null) => void;
    setDraggingPinnedId: (id: string | null) => void;
    setIsLoading: (loading: boolean) => void;
    setIsSaving: (saving: boolean) => void;
    addLink: () => void;
    removeLink: (index: number) => void;
    updateLink: (index: number, field: 'url' | 'label', value: string) => void;
    moveLink: (index: number, direction: 'up' | 'down') => void;
    togglePinned: (projectId: string) => void;
    reorderPinned: (draggedId: string, targetId: string) => void;
    initializeFromProfile: (data: PublicUserProfile, userHandle?: string | null) => void;
    reset: () => void;
  };
}

const initialState = {
  profileData: null as PublicUserProfile | null,
  bio: '',
  links: [] as ProfileLink[],
  handleInput: '',
  pinnedIds: [] as string[],
  handleError: null as string | null,
  draggingPinnedId: null as string | null,
  isLoading: false,
  isSaving: false,
};

export const useMyProfileStore = create<MyProfileState>((set) => ({
  ...initialState,

  actions: {
    setProfileData: (data) => set({ profileData: data }),
    setBio: (bio) => set({ bio }),
    setLinks: (links) => set({ links }),
    setHandleInput: (value) => set({ handleInput: value }),
    setPinnedIds: (ids) => set({ pinnedIds: ids }),
    setHandleError: (error) => set({ handleError: error }),
    setDraggingPinnedId: (id) => set({ draggingPinnedId: id }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setIsSaving: (saving) => set({ isSaving: saving }),

    addLink: () =>
      set((state) => ({
        links: [...state.links, { label: null, url: '' }],
      })),

    removeLink: (index) =>
      set((state) => ({
        links: state.links.filter((_, i) => i !== index),
      })),

    updateLink: (index, field, value) =>
      set((state) => ({
        links: state.links.map((link, i) =>
          i === index ? { ...link, [field]: value || null } : link,
        ),
      })),

    moveLink: (index, direction) =>
      set((state) => {
        const next = [...state.links];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= next.length) {
          return state;
        }
        const temp = next[targetIndex];
        next[targetIndex] = next[index];
        next[index] = temp;
        return { links: next };
      }),

    togglePinned: (projectId) =>
      set((state) => ({
        pinnedIds: state.pinnedIds.includes(projectId)
          ? state.pinnedIds.filter((id) => id !== projectId)
          : [...state.pinnedIds, projectId],
      })),

    reorderPinned: (draggedId, targetId) =>
      set((state) => {
        const current = state.pinnedIds.slice();
        if (!current.includes(draggedId) || !current.includes(targetId)) {
          return state;
        }
        const without = current.filter((id) => id !== draggedId);
        const targetIndex = without.indexOf(targetId);
        if (targetIndex === -1) return state;
        without.splice(targetIndex, 0, draggedId);
        return { pinnedIds: without };
      }),

    initializeFromProfile: (data, userHandle) =>
      set({
        profileData: data,
        bio: data.profile.bio ?? '',
        links: (data.profile.links ?? []).filter(
          (l: ProfileLink) => typeof l.url === 'string' && l.url.trim().length > 0,
        ),
        pinnedIds: data.profile.pinnedProjectIds ?? [],
        handleInput: userHandle ?? '',
        handleError: null,
      }),

    reset: () => set(initialState),
  },
}));
