type Publishing = { publishers: number; firstPublishers: number; repeatPublishers: number };
export type Daily = {
  day: string;
  pv: number | null;
  visits: number | null;
  appsPv: number | null;
  uv: number | null;
  publishers: number;
  registrations: number;
  projects: number;
  attempts: number;
  succeeded: number;
  cliAttempts: number;
  webAttempts: number;
};
type ChannelMetrics = {
  attempts: number;
  succeeded: number;
  failed: number;
  pending: number;
  projects: number;
  users: number;
  successfulUsers: number;
};
export type GrowthReport = {
  period: {
    days: number;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    today: string;
    rawFrom: string;
  };
  daily: Daily[];
  today: Daily;
  current: Record<string, number | null>;
  previous: Record<string, number | null>;
  observedUv: number;
  uvPartial: boolean;
  publishing: { current: Publishing; previous: Publishing };
  previousCohort: { registered: number; activated: number; deployed: number };
  cohort: { registered: number; activated: number; deployed: number };
  channels: { channel: string; current: ChannelMetrics; previous: ChannelMetrics }[];
  referrers: { count: number; sum: { visits: number }; dimensions: { refererHost: string } }[];
  devices: { count: number; sum: { visits: number }; dimensions: { deviceType: string } }[];
  web: {
    fetchedAt: number | null;
    stale: boolean;
    error: string | null;
    adaptiveSampling: boolean;
  };
  generatedAt: number;
  cached: boolean;
  rowsRead: number;
};
export const number = (value: number | null | undefined) =>
  value == null ? '—' : Math.round(value).toLocaleString('zh-CN');
export const percent = (n: number, denominator: number) =>
  denominator ? `${((n / denominator) * 100).toFixed(1)}%` : '—';
export const change = (current: number | null, previous: number | null) =>
  current == null || previous == null
    ? '缺少可比较数据'
    : previous === 0
      ? current === 0
        ? '两个周期均为 0'
        : '上期为 0，新增 ' + number(current)
      : `${current >= previous ? '↑' : '↓'} ${Math.abs(((current - previous) / previous) * 100).toFixed(1)}% 较上一等长周期`;
