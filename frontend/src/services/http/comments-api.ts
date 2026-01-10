import { APP_CONFIG, API_ROUTES } from '@/constants';
import type { PaginatedResponse, ProjectComment } from '@/types';

export interface FetchProjectCommentsParams {
  page?: number;
  pageSize?: number;
}

export async function fetchProjectComments(
  projectId: string,
  params: FetchProjectCommentsParams = {},
): Promise<PaginatedResponse<ProjectComment>> {
  const query = new URLSearchParams();
  if (typeof params.page === 'number') query.set('page', String(params.page));
  if (typeof params.pageSize === 'number') {
    query.set('pageSize', String(params.pageSize));
  }

  const url = `${APP_CONFIG.API_BASE_URL}${API_ROUTES.PROJECT_COMMENTS(projectId)}${
    query.toString() ? `?${query.toString()}` : ''
  }`;

  const res = await fetch(url, { method: 'GET', credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to load comments');
  }
  return (await res.json()) as PaginatedResponse<ProjectComment>;
}

export async function createProjectComment(
  projectId: string,
  input: { content: string; replyToCommentId?: string | null },
): Promise<ProjectComment> {
  const res = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.PROJECT_COMMENTS(projectId)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: input.content,
        replyToCommentId: input.replyToCommentId ?? null,
      }),
    },
  );

  if (res.status === 401) {
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to create comment');
  }

  const data = (await res.json()) as { comment: ProjectComment };
  return data.comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const res = await fetch(
    `${APP_CONFIG.API_BASE_URL}${API_ROUTES.COMMENT_BY_ID(commentId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
    },
  );

  if (res.status === 401) {
    throw new Error('unauthorized');
  }

  if (!res.ok) {
    throw new Error('Failed to delete comment');
  }
}

