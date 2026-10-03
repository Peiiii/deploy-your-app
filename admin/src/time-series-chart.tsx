import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export type ChartDay = { day: string; values: Record<string, number | null> };
export type ChartSeries = { key: string; label: string; color: string; unit: string };
const formatted = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const valueAt = (day: ChartDay, key: string) => {
  const value = day.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};
const x = (index: number, length: number) => 45 + (index / Math.max(1, length - 1)) * 600;

export default function TimeSeriesChart({
  data,
  series,
  title,
  kind = 'line',
}: {
  data: ChartDay[];
  series: ChartSeries[];
  title: string;
  kind?: 'line' | 'bar';
}) {
  const frame = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const id = useId();
  const context = `${title}:${kind}:${series.map((s) => s.key).join(',')}:${data.map((d) => d.day).join(',')}`;
  const [selection, setSelection] = useState<{
    context: string;
    index: number;
    pinned: boolean;
  } | null>(null);
  const active = selection?.context === context && data[selection.index] ? selection : null;
  const hasSelection = active !== null;
  const max = Math.max(2, ...data.flatMap((day) => series.map((s) => valueAt(day, s.key) ?? 0)));
  const y = (value: number) => 165 - (value / max) * 125;
  const barWidth = Math.min(36, 500 / Math.max(1, data.length)) / Math.max(1, series.length);

  useEffect(() => {
    if (plot.current) plot.current.scrollLeft = plot.current.scrollWidth;
  }, [context]);
  useEffect(() => {
    if (!hasSelection) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null);
    };
    const outside = (event: globalThis.PointerEvent) => {
      if (!frame.current?.contains(event.target as Node)) setSelection(null);
    };
    const resize = () => setSelection(null);
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', resize);
    };
  }, [hasSelection]);

  const select = (index: number, pinned = false, reveal = false) => {
    if (!data.length) return;
    const next = Math.max(0, Math.min(data.length - 1, index));
    if (reveal && plot.current && svg.current) {
      const point = (x(next, data.length) / 680) * svg.current.getBoundingClientRect().width;
      plot.current.scrollLeft = point - plot.current.clientWidth / 2;
    }
    setSelection((previous) =>
      previous?.context === context && previous.index === next && previous.pinned === pinned
        ? previous
        : { context, index: next, pinned }
    );
  };
  const nearest = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return Math.round(
      ((((event.clientX - bounds.left) / bounds.width) * 680 - 45) / 600) *
        Math.max(1, data.length - 1)
    );
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = active?.index ?? data.length - 1;
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: data.length - 1 }[
      event.key
    ];
    if (next !== undefined) {
      event.preventDefault();
      select(next, false, true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSelection(null);
    }
  };
  const scroll = () => {
    if (!active || !plot.current || !svg.current) return;
    const drawing = svg.current.getBoundingClientRect();
    const bounds = plot.current.getBoundingClientRect();
    const point = drawing.left + (x(active.index, data.length) / 680) * drawing.width;
    if (point < bounds.left || point > bounds.right) setSelection(null);
    else select(active.index, active.pinned);
  };
  return (
    <div
      ref={frame}
      className="chart-frame"
      onPointerLeave={() => {
        if (!active?.pinned && document.activeElement !== plot.current) setSelection(null);
      }}
    >
      {!data.length ? (
        <p className="muted">这段时间没有可用的图表数据。</p>
      ) : (
        <>
          <div
            id={id}
            role={active ? 'tooltip' : undefined}
            className="chart-tooltip"
            aria-live={active ? 'polite' : undefined}
            aria-atomic="true"
          >
            <strong>
              {active ? data[active.index].day : '选择日期'}{' '}
              <small>{active ? 'UTC' : '查看数值'}</small>
            </strong>
            <div className="chart-values">
              {series.map((s) => {
                const value = active ? valueAt(data[active.index], s.key) : null;
                return (
                  <div className="chart-tooltip-value" key={s.key}>
                    <span>
                      <i style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <b>
                      {!active
                        ? '—'
                        : value === null
                          ? '暂无数据'
                          : `${formatted(value)} ${s.unit}`}
                    </b>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            ref={plot}
            className="growth-plot chart-plot"
            tabIndex={0}
            role="group"
            aria-label={`${title}图表；左右键逐日查看，Home/End到首末日，Esc关闭数值提示；可横向滚动`}
            aria-describedby={active ? id : undefined}
            onFocus={() => select(active?.index ?? data.length - 1, false, true)}
            onBlur={() => {
              if (!active?.pinned) setSelection(null);
            }}
            onKeyDown={keyboard}
            onScroll={scroll}
          >
            <svg
              ref={svg}
              viewBox="0 0 680 210"
              role="img"
              aria-label={title}
              onPointerMove={(event) => {
                if (event.pointerType === 'mouse') select(nearest(event));
              }}
              onPointerDown={(event) => {
                press.current = { x: event.clientX, y: event.clientY };
              }}
              onPointerCancel={() => {
                press.current = null;
                setSelection(null);
              }}
              onPointerUp={(event) => {
                const start = press.current;
                press.current = null;
                if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10)
                  select(nearest(event), event.pointerType !== 'mouse');
              }}
            >
              <title>{title}；悬停或点按绘图区查看每日数值，也可使用键盘左右键。</title>
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
                    {formatted(max * scale)}
                  </text>
                </g>
              ))}
              {series.map((s, seriesIndex) => {
                const segments: string[] = [];
                let segment = '';
                data.forEach((day, index) => {
                  const value = valueAt(day, s.key);
                  if (value === null) {
                    if (segment) segments.push(segment);
                    segment = '';
                  } else segment += `${segment ? ' L' : 'M'}${x(index, data.length)},${y(value)}`;
                });
                if (segment) segments.push(segment);
                return (
                  <g key={s.key}>
                    {kind === 'line' &&
                      segments.map((d, index) => (
                        <path
                          key={index}
                          d={d}
                          fill="none"
                          stroke={s.color}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    {data.map((day, index) => {
                      const value = valueAt(day, s.key);
                      if (value === null) return null;
                      return kind === 'line' ? (
                        <circle
                          key={day.day}
                          cx={x(index, data.length)}
                          cy={y(value)}
                          r={active?.index === index ? 5 : 3.5}
                          fill={s.color}
                        />
                      ) : (
                        <rect
                          key={day.day}
                          x={x(index, data.length) + (seriesIndex - series.length / 2) * barWidth}
                          y={y(value)}
                          width={Math.max(1, barWidth - 2)}
                          height={165 - y(value)}
                          rx="2"
                          fill={s.color}
                          opacity={active && active.index !== index ? 0.55 : 1}
                        />
                      );
                    })}
                  </g>
                );
              })}
              {active && (
                <line
                  className="chart-reference"
                  x1={x(active.index, data.length)}
                  y1="28"
                  x2={x(active.index, data.length)}
                  y2="170"
                  stroke="#aaa1bb"
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
              )}
              {data.map(
                (day, index) =>
                  (data.length <= 7 || index % 5 === 0 || index === data.length - 1) && (
                    <text
                      key={day.day}
                      x={x(index, data.length)}
                      y="194"
                      textAnchor="middle"
                      fill="#9297a8"
                      fontSize="11"
                    >
                      {day.day.slice(5)}
                    </text>
                  )
              )}
            </svg>
          </div>
          <p className="chart-help">悬停或点按查看数值 · 左右键切换日期 · Esc 关闭</p>
        </>
      )}
    </div>
  );
}
