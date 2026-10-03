export const DAILY_PROJECT_LIMIT = 20;

// A Beijing calendar day, represented as UTC timestamps for stored ISO dates.
export function projectCreationWindow(now = new Date()) {
  const dayMs = 86_400_000;
  const offsetMs = 8 * 3_600_000;
  const startMs = Math.floor((now.getTime() + offsetMs) / dayMs) * dayMs - offsetMs;
  return {
    createdAt: now.toISOString(),
    startAt: new Date(startMs).toISOString(),
    resetAt: new Date(startMs + dayMs).toISOString(),
  };
}
