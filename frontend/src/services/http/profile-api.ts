import { APP_CONFIG } from '../../constants';
import type { PublicUserProfile, UserProfile } from '../../types';

const API_BASE = APP_CONFIG.API_BASE_URL;

export async function fetchMyProfile(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/me/profile`, {
    method: 'GET',
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    throw new Error('Failed to load profile');
  }

  const data = (await res.json()) as { profile: UserProfile };
  return data.profile;
}

export async function updateMyProfile(
  patch: Partial<UserProfile>,
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/me/profile`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (res.status === 401) {
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    throw new Error('Failed to update profile');
  }

  const data = (await res.json()) as { profile: UserProfile };
  return data.profile;
}

export async function fetchPublicProfile(
  userId: string,
): Promise<PublicUserProfile> {
  const res = await fetch(
    `${API_BASE}/users/${encodeURIComponent(userId)}/profile`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  if (res.status === 404) {
    throw new Error('not_found');
  }

  if (!res.ok) {
    throw new Error('Failed to load public profile');
  }

  const data = (await res.json()) as PublicUserProfile;
  return data;
}

