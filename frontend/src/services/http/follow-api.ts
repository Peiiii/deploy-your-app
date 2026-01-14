import { APP_CONFIG, API_ROUTES } from '@/constants';

export interface FollowSummaryResponse {
  followersCount: number;
  isFollowing: boolean;
}

export async function fetchFollowSummary(
  identifier: string,
): Promise<FollowSummaryResponse> {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.USER_FOLLOW(identifier)}`,
  );
  if (!response.ok) {
    throw new Error('Failed to load follow status');
  }
  return response.json();
}

export async function followUser(
  identifier: string,
): Promise<FollowSummaryResponse> {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.USER_FOLLOW(identifier)}`,
    { method: 'POST' },
  );
  if (response.status === 401) {
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    throw new Error('Failed to follow user');
  }
  return response.json();
}

export async function unfollowUser(
  identifier: string,
): Promise<FollowSummaryResponse> {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.USER_FOLLOW(identifier)}`,
    { method: 'DELETE' },
  );
  if (response.status === 401) {
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    throw new Error('Failed to unfollow user');
  }
  return response.json();
}

