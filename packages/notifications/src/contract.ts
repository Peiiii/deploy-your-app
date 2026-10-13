export const notificationKinds = [
  'comment',
  'reply',
  'like',
  'favorite',
  'follow',
  'feedback_reply',
  'feedback_status',
  'deployment_success',
  'deployment_failure',
] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export type NotificationCategory = 'comments' | 'reactions' | 'follows' | 'system';
export const categoryFor = (kind: NotificationKind): NotificationCategory =>
  kind === 'comment' || kind === 'reply'
    ? 'comments'
    : kind === 'like' || kind === 'favorite'
      ? 'reactions'
      : kind === 'follow'
        ? 'follows'
        : 'system';
export interface NotificationItem {
  groupKey: string;
  throughSeq: number;
  kind: NotificationKind;
  category: NotificationCategory;
  important: boolean;
  unread: boolean;
  muted: boolean;
  count: number;
  title: string;
  actorName: string | null;
  excerpt: string | null;
  subjectId: string;
  commentId: string | null;
  at: number;
  target: string;
  needsReply: boolean;
  firstUnreadAt: number | null;
}
export interface NotificationSummary {
  important: number;
  ordinary: number;
  snapshotSeq: number;
}
export interface NotificationPage extends NotificationSummary {
  items: NotificationItem[];
  cursor: string | null;
}
export interface NotificationPreferences {
  badges: Record<NotificationCategory, boolean>;
  external: { direct: boolean; feedback: boolean; deployment: boolean; digest: boolean };
  timezone: string;
  quietStart: number;
  quietEnd: number;
  pausedUntil: number;
  pushAvailable: boolean;
  reducedCategories: ('direct' | 'feedback' | 'deployment')[];
}
export const defaultPreferences = (): NotificationPreferences => ({
  badges: { comments: true, reactions: true, follows: true, system: true },
  external: { direct: false, feedback: false, deployment: false, digest: false },
  timezone: '',
  quietStart: 22 * 60,
  quietEnd: 8 * 60,
  pausedUntil: 0,
  pushAvailable: false,
  reducedCategories: [],
});
