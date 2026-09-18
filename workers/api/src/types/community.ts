export type FeedbackCategory = 'general' | 'idea' | 'bug' | 'question';

export type FeedbackStatus = 'open' | 'planned' | 'in_progress' | 'completed';

export interface CommunityAuthor {
  id: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FeedbackPost {
  id: string;
  title: string;
  content: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthor;
  canDelete: boolean;
  canUpdateStatus: boolean;
}

export interface FeedbackComment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthor;
  canDelete: boolean;
}

export interface CommunityViewer {
  userId: string;
  isAdmin: boolean;
}
