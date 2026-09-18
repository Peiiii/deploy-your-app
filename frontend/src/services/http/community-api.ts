import { APP_CONFIG, API_ROUTES } from '@/constants';
import type {
  FeedbackCategory,
  FeedbackComment,
  FeedbackPost,
  FeedbackStatus,
  PaginatedResponse,
} from '@/types';

export class CommunityApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'CommunityApiError';
  }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new CommunityApiError(body.error ?? 'Community request failed', response.status);
  }
  return response.json() as Promise<T>;
};

export interface FetchFeedbackParams {
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  page?: number;
  pageSize?: number;
}

export const fetchFeedbackPosts = async (
  params: FetchFeedbackParams = {}
): Promise<PaginatedResponse<FeedbackPost>> => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMUNITY_FEEDBACK}${suffix}`,
    { credentials: 'include' }
  );
  return parseResponse<PaginatedResponse<FeedbackPost>>(response);
};

export const createFeedbackPost = async (input: {
  title: string;
  content: string;
  category?: FeedbackCategory;
}): Promise<FeedbackPost> => {
  const response = await fetch(`${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMUNITY_FEEDBACK}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseResponse<{ post: FeedbackPost }>(response);
  return body.post;
};

export const updateFeedbackStatus = async (
  postId: string,
  status: FeedbackStatus
): Promise<FeedbackPost> => {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMUNITY_FEEDBACK_STATUS(postId)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }
  );
  const body = await parseResponse<{ post: FeedbackPost }>(response);
  return body.post;
};

export const deleteFeedbackPost = async (postId: string): Promise<void> => {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMUNITY_FEEDBACK_BY_ID(postId)}`,
    { method: 'DELETE', credentials: 'include' }
  );
  await parseResponse<{ ok: true }>(response);
};

export const fetchFeedbackComments = async (postId: string): Promise<FeedbackComment[]> => {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMUNITY_FEEDBACK_COMMENTS(postId)}`,
    { credentials: 'include' }
  );
  const body = await parseResponse<{ items: FeedbackComment[] }>(response);
  return body.items;
};

export const createFeedbackComment = async (
  postId: string,
  content: string
): Promise<FeedbackComment> => {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMUNITY_FEEDBACK_COMMENTS(postId)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  );
  const body = await parseResponse<{ comment: FeedbackComment }>(response);
  return body.comment;
};

export const deleteFeedbackComment = async (commentId: string): Promise<void> => {
  const response = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMUNITY_COMMENT_BY_ID(commentId)}`,
    { method: 'DELETE', credentials: 'include' }
  );
  await parseResponse<{ ok: true }>(response);
};
