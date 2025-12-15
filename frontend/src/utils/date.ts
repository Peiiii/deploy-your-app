export function formatRelativeTime(
  dateString: string,
  translations: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  },
): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return translations.justNow;
    if (diffMins < 60) return `${diffMins}${translations.minutesAgo}`;
    if (diffHours < 24) return `${diffHours}${translations.hoursAgo}`;
    if (diffDays < 7) return `${diffDays}${translations.daysAgo}`;
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }).format(date);
  } catch {
    return dateString;
  }
}
