export interface CommentReplyTo {
  commentId: string;
  userId: string | null;
  handle: string | null;
  displayName: string | null;
}

export interface CommentAuthor {
  id: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  replyTo: CommentReplyTo | null;
  // Whether current viewer can delete this comment (author or admin).
  canDelete: boolean;
}
