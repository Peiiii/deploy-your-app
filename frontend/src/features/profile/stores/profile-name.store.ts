import { create } from 'zustand';
import { useAuthStore } from '@/features/auth/stores/auth.store';

// Drafts and dismissals live only for this app visit. The account remains in AuthStore.
export const useProfileNameStore = create<{
  dismissedUserIds: string[];
  editingUserId: string | null;
  displayName: string;
  handle: string;
  error: string | null;
  isSaving: boolean;
}>(() => ({
  dismissedUserIds: [],
  editingUserId: null,
  displayName: '',
  handle: '',
  error: null,
  isSaving: false,
}));

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id === previous.user?.id) return;
  useProfileNameStore.setState({
    editingUserId: null, displayName: '', handle: '', error: null, isSaving: false,
  });
});
