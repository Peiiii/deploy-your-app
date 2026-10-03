import { lazy, Suspense } from 'react';
export type ChartDay = { day: string; values: Record<string, number | null> };
export type ChartSeries = { key: string; label: string; color: string; unit: string };
const Plot = lazy(() => import('./time-series-plot'));
export default function TimeSeriesChart(props: {
  data: ChartDay[];
  series: ChartSeries[];
  title: string;
  kind?: 'line' | 'bar';
}) {
  if (!props.data.length) return <p className="muted">这段时间没有可用的图表数据。</p>;
  return (
    <Suspense
      fallback={
        <div className="chart-frame">
          <div className="chart-plot chart-loading" role="status">
            正在加载图表…
          </div>
        </div>
      }
    >
      <Plot
        key={`${props.title}:${props.kind}:${props.series.map((s) => s.key).join(',')}:${props.data.map((d) => d.day).join(',')}`}
        {...props}
      />
    </Suspense>
  );
}
