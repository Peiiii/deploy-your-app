import { useEffect, useRef } from 'react';
import { number, type Daily } from './growth-report';

export default function GrowthChart({
  daily,
  metric,
  title,
  color,
  hint,
}: {
  daily: Daily[];
  metric: 'pv' | 'uv' | 'appsPv' | 'publishers' | 'registrations' | 'cliAttempts';
  title: string;
  color: string;
  hint: string;
}) {
  const plot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (plot.current) plot.current.scrollLeft = plot.current.scrollWidth;
  }, [daily]);
  const values = daily.map((row) => row[metric]);
  const max = Math.max(2, ...values.filter((v): v is number => v !== null));
  const x = (i: number) => 45 + (i / Math.max(1, daily.length - 1)) * 600;
  const y = (n: number) => 165 - (n / max) * 125;
  const segments: string[] = [];
  let segment = '';
  values.forEach((value, i) => {
    if (value === null) {
      if (segment) segments.push(segment);
      segment = '';
    } else segment += `${segment ? ' L' : 'M'}${x(i)},${y(value)}`;
  });
  if (segment) segments.push(segment);
  return (
    <article className="panel growth-chart">
      <div className="spread">
        <h3>{title}</h3>
        <span className="tag">按日</span>
      </div>
      <div ref={plot} className="growth-plot" tabIndex={0} aria-label={`${title}图表，可横向滚动`}>
        <svg viewBox="0 0 680 210" role="img" aria-label={title}>
          <title>{title}；各点可查看每日数值，图表可横向滚动</title>
          {[0, 0.5, 1].map((scale) => (
            <g key={scale}>
              <line
                x1="45"
                y1={y(max * scale)}
                x2="645"
                y2={y(max * scale)}
                stroke="#e9e8f0"
                strokeDasharray="4 5"
              />
              <text x="35" y={y(max * scale) + 4} textAnchor="end" fill="#9297a8" fontSize="11">
                {number(max * scale)}
              </text>
            </g>
          ))}
          {segments.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {daily.map((row, i) => (
            <g key={row.day}>
              {row[metric] !== null && (
                <circle cx={x(i)} cy={y(row[metric]!)} r="3.5" fill={color}>
                  <title>
                    {row.day}：{number(row[metric])}
                  </title>
                </circle>
              )}
              {(daily.length <= 7 || i % 5 === 0 || i === daily.length - 1) && (
                <text x={x(i)} y="194" textAnchor="middle" fill="#9297a8" fontSize="11">
                  {row.day.slice(5)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="footnote">{hint}</p>
    </article>
  );
}
