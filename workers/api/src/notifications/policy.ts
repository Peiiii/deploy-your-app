import type { NotificationPreferences } from '@gemigo/notifications';
export function localTime(at: number, timezone: string): { minute: number; day: string } | null {
  if (!timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(at));
    const field = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return {
      minute: Number(field('hour')) * 60 + Number(field('minute')),
      day: field('year') + '-' + field('month') + '-' + field('day'),
    };
  } catch {
    return null;
  }
}
export function quiet(at: number, prefs: NotificationPreferences): boolean {
  const time = localTime(at, prefs.timezone);
  if (!time) return true;
  return (
    prefs.quietStart === prefs.quietEnd ||
    (prefs.quietStart < prefs.quietEnd
      ? time.minute >= prefs.quietStart && time.minute < prefs.quietEnd
      : time.minute >= prefs.quietStart || time.minute < prefs.quietEnd)
  );
}
export function nextAllowed(at: number, prefs: NotificationPreferences): number | null {
  if (!localTime(at, prefs.timezone) || prefs.quietStart === prefs.quietEnd) return null;
  let next = Math.max(at, prefs.pausedUntil);
  for (let i = 0; i < 721; i++, next += 120000) if (!quiet(next, prefs)) return next;
  return null;
}
