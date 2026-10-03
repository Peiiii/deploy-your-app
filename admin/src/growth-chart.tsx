import type { Daily } from './growth-report';
import TimeSeriesChart from './time-series-chart';

const metrics = {
  pv: { label: '官网真人 PV', unit: '次' },
  uv: { label: '官网观测 UV', unit: '个浏览器标识' },
  appsPv: { label: '全部应用真人 PV', unit: '次' },
  publishers: { label: '成功发布创作者', unit: '人' },
  registrations: { label: '新增注册', unit: '人' },
  cliAttempts: { label: 'CLI 部署尝试', unit: '次' },
};
export default function GrowthChart({
  daily,
  metric,
  title,
  color,
  hint,
}: {
  daily: Daily[];
  metric: keyof typeof metrics;
  title: string;
  color: string;
  hint: string;
}) {
  return (
    <article className="panel growth-chart">
      <div className="spread">
        <h3>{title}</h3>
        <span className="tag">按日</span>
      </div>
      <TimeSeriesChart
        title={title}
        data={daily.map((row) => ({ day: row.day, values: { [metric]: row[metric] } }))}
        series={[{ key: metric, color, ...metrics[metric] }]}
      />
      <p className="footnote">{hint}</p>
    </article>
  );
}
