import { useMyProfileStore } from '@/stores/myProfileStore';
import { useProjectStore } from '@/stores/projectStore';
import { fetchPublicProfile, updateMyProfile } from '@/services/http/profileApi';
import type { AuthManager } from './AuthManager';
import type { UIManager } from './UIManager';
import i18n from '@i18n/config';

/**
 * MyProfileManager handles all business logic for the MyProfile page.
 * All methods are arrow functions to avoid `this` binding issues.
 */
export class MyProfileManager {
  private authManager: AuthManager;
  private uiManager: UIManager;

  constructor(authManager: AuthManager, uiManager: UIManager) {
    this.authManager = authManager;
    this.uiManager = uiManager;
  }

  /**
   * Load the current user's profile data.
   */
  loadProfile = async () => {
    const user = this.authManager.getCurrentUser();
    if (!user) return;

    const actions = useMyProfileStore.getState().actions;
    actions.setIsLoading(true);

    try {
      const data = await fetchPublicProfile(user.id);
      actions.initializeFromProfile(data, user.handle);
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      actions.setIsLoading(false);
    }
  };

  /**
   * Validate handle input and set error if invalid.
   */
  validateHandle = (value: string) => {
    const t = i18n.t.bind(i18n);
    const actions = useMyProfileStore.getState().actions;
    const trimmed = value.trim();

    actions.setHandleInput(value);

    if (!trimmed) {
      actions.setHandleError(null);
      return true;
    }
    if (trimmed.length < 3 || trimmed.length > 24) {
      actions.setHandleError(
        t('profile.handleErrorLength', 'Handle must be 3–24 characters.'),
      );
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      actions.setHandleError(
        t(
          'profile.handleErrorCharset',
          'Handle can only contain lowercase letters, numbers and dashes.',
        ),
      );
      return false;
    }
    actions.setHandleError(null);
    return true;
  };

  /**
   * Save the profile (handle, bio, links, pinned projects).
   */
  saveProfile = async () => {
    const user = this.authManager.getCurrentUser();
    if (!user) return;

    const t = i18n.t.bind(i18n);
    const state = useMyProfileStore.getState();
    const actions = state.actions;

    if (state.handleError) {
      this.uiManager.showErrorToast(state.handleError);
      return;
    }

    actions.setIsSaving(true);

    try {
      // Update handle if changed
      const trimmedHandle = state.handleInput.trim();
      if (trimmedHandle && trimmedHandle !== (user.handle ?? '')) {
        await this.authManager.updateHandle(trimmedHandle);
      }

      // Prepare valid links
      const validLinks = state.links
        .filter((l) => l.url && l.url.trim().length > 0)
        .map((l) => ({
          label: l.label && l.label.trim().length > 0 ? l.label.trim() : null,
          url: l.url.trim(),
        }));

      // Update profile
      const nextProfile = await updateMyProfile({
        bio: state.bio,
        links: validLinks,
        pinnedProjectIds: state.pinnedIds,
      });

      // Update store
      actions.setProfileData(
        state.profileData
          ? { ...state.profileData, profile: nextProfile }
          : null,
      );
      actions.setLinks(validLinks);
      this.uiManager.showSuccessToast(t('profile.updateSuccess'));
    } catch (error) {
      console.error('Failed to update profile', error);
      if (error instanceof Error) {
        actions.setHandleError(error.message);
        this.uiManager.showErrorToast(error.message);
      } else {
        this.uiManager.showErrorToast(t('profile.updateError'));
      }
    } finally {
      actions.setIsSaving(false);
    }
  };

  /**
   * Copy public profile URL to clipboard.
   */
  copyPublicUrl = (copyToClipboard: (url: string) => void) => {
    const user = this.authManager.getCurrentUser();
    if (!user) return;

    const identifier =
      user.handle && user.handle.trim().length > 0
        ? user.handle.trim()
        : user.id;
    const url = `${window.location.origin}/u/${encodeURIComponent(identifier)}`;
    copyToClipboard(url);
  };

  /**
   * Open public profile in a new tab.
   */
  openPublicProfile = () => {
    const user = this.authManager.getCurrentUser();
    if (!user) return;

    const identifier =
      user.handle && user.handle.trim().length > 0
        ? user.handle.trim()
        : user.id;
    window.open(
      `/u/${encodeURIComponent(identifier)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  /**
   * Get public projects for the current user.
   */
  getMyProjects = () => {
    const user = this.authManager.getCurrentUser();
    if (!user) return [];
    const allProjects = useProjectStore.getState().projects;
    return allProjects.filter(
      (p) => p.ownerId === user.id && p.isPublic !== false,
    );
  };

  /**
   * Handle drag start for pinned project reordering.
   */
  handlePinnedDragStart = (projectId: string) => {
    useMyProfileStore.getState().actions.setDraggingPinnedId(projectId);
  };

  /**
   * Handle drag end for pinned project reordering.
   */
  handlePinnedDragEnd = () => {
    useMyProfileStore.getState().actions.setDraggingPinnedId(null);
  };

  /**
   * Handle drop for pinned project reordering.
   */
  handlePinnedDrop = (targetId: string) => {
    const state = useMyProfileStore.getState();
    const draggedId = state.draggingPinnedId;
    if (!draggedId || draggedId === targetId) {
      state.actions.setDraggingPinnedId(null);
      return;
    }
    if (!state.pinnedIds.includes(targetId)) {
      state.actions.setDraggingPinnedId(null);
      return;
    }
    state.actions.reorderPinned(draggedId, targetId);
    state.actions.setDraggingPinnedId(null);
  };
}
