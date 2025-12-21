/**
 * Notify API types
 */

/** Notification action button */
export interface NotifyAction {
  id: string;
  label: string;
}

/** Notification options */
export interface NotifyOptions {
  /** Notification title (required) */
  title: string;
  /** Notification body text */
  body?: string;
  /** Icon URL */
  icon?: string;
  /** Action buttons (desktop only) */
  actions?: NotifyAction[];
}

/** Notification result */
export interface NotifyResult {
  success: boolean;
  reason?: string;
}

/** Notify function signature */
export type NotifyFn = (options: NotifyOptions) => Promise<NotifyResult>;

/** Notification action handler */
export type NotificationActionHandler = (actionId: string, callback: () => void) => () => void;
