import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { init, use as registerCharts, type EChartsType } from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

registerCharts([LineChart, BarChart, GridComponent, TooltipComponent, SVGRenderer]);
import type { ChartDay, ChartSeries } from './time-series-chart';
type ChartSpec = { data: ChartDay[]; series: ChartSeries[]; title: string; kind: 'line' | 'bar' };
const formatted = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const valueAt = (day: ChartDay, key: string) => {
  const value = day.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export default function TimeSeriesPlot({
  data,
  series,
  title,
  kind = 'line',
}: Omit<ChartSpec, 'kind'> & { kind?: ChartSpec['kind'] }) {
  const frame = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const control = useRef<{
    show: (index: number) => void;
    hide: () => void;
    pick: (x: number, y: number) => void;
    hover: () => void;
  } | null>(null);
  const index = useRef(0);
  const press = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const id = useId();
  // Business wrappers map fresh arrays on render; recreate only when the actual chart snapshot changes.
  const spec = JSON.stringify({ data, series, title, kind });
  useEffect(() => {
    if (!surface.current) return;
    const { data, series, title, kind } = JSON.parse(spec) as ChartSpec;
    if (!data.length) return;
    const host = surface.current;
    const chart: EChartsType = init(host, null, { renderer: 'svg' });
    index.current = data.length - 1;
    const tip = document.createElement('div');
    tip.id = id;
    tip.className = 'chart-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-live', 'polite');
    tip.setAttribute('aria-atomic', 'true');
    chart.setOption({
      animation: false,
      grid: { left: 16, right: 44, top: 20, bottom: 34 },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.day),
        boundaryGap: kind === 'bar',
        axisLine: { lineStyle: { color: '#ddd9e5' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#898397',
          fontSize: 10,
          formatter: (day: string) => day.slice(5),
          hideOverlap: true,
        },
        axisPointer: { snap: false, label: { formatter: (p: { value: string }) => p.value } },
      },
      yAxis: {
        type: 'value',
        position: 'right',
        min: 0,
        minInterval: 1,
        splitNumber: 3,
        axisLabel: { color: '#898397', fontSize: 10, formatter: formatted },
        splitLine: { lineStyle: { color: '#eae7f0', type: 'dashed' } },
        axisPointer: { label: { formatter: (p: { value: number }) => formatted(Number(p.value)) } },
      },
      tooltip: {
        trigger: 'axis',
        renderMode: 'html',
        enterable: true,
        confine: true,
        transitionDuration: 0,
        hideDelay: 100,
        padding: [8, 10],
        backgroundColor: '#fffffffa',
        borderColor: '#e4deed',
        borderWidth: 1,
        textStyle: { color: '#30253a', fontSize: 12 },
        extraCssText: 'border-radius:6px;box-shadow:0 3px 12px #35214d18;',
        axisPointer: {
          type: 'cross',
          lineStyle: { color: '#aaa0ba', width: 1, type: 'dashed' },
          crossStyle: { color: '#aaa0ba', width: 1, type: 'dashed' },
          label: { backgroundColor: '#625674', fontSize: 10, padding: [4, 6] },
        },
        formatter: (params: { dataIndex: number } | { dataIndex: number }[]) => {
          const selected = (Array.isArray(params) ? params[0] : params)?.dataIndex;
          if (selected === undefined || !data[selected]) return '';
          index.current = selected;
          tip.replaceChildren();
          tip.style.maxWidth = `${Math.max(120, chart.getWidth() - 38)}px`;
          const date = document.createElement('strong');
          date.textContent = `${data[selected].day} UTC`;
          tip.append(date);
          for (const s of series) {
            const row = document.createElement('div');
            row.className = 'chart-tooltip-value';
            const label = document.createElement('span');
            const dot = document.createElement('i');
            dot.style.background = s.color;
            label.append(dot, s.label);
            const number = document.createElement('b');
            const value = valueAt(data[selected], s.key);
            number.textContent = value === null ? '暂无数据' : `${formatted(value)} ${s.unit}`;
            row.append(label, number);
            tip.append(row);
          }
          host.setAttribute('aria-describedby', id);
          return tip;
        },
        position: (
          _pointer: number[],
          params: { dataIndex: number } | { dataIndex: number }[],
          _dom: HTMLElement,
          _rect: unknown,
          size: { contentSize: number[]; viewSize: number[] }
        ) => {
          const selected = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? index.current;
          const value = valueAt(data[selected], series[0].key);
          const x = chart.convertToPixel({ xAxisIndex: 0 }, selected) as number;
          const y =
            value === null ? 90 : (chart.convertToPixel({ yAxisIndex: 0 }, value) as number);
          const [w, h] = size.contentSize,
            [width, height] = size.viewSize;
          const gap = 12;
          // Stock-style placement: beside the selected point, then flip; narrow charts use vertical space.
          if (x + gap + w <= width - 4)
            return [x + gap, Math.max(4, Math.min(y - h / 2, height - 34 - h))];
          if (x - gap - w >= 4)
            return [x - gap - w, Math.max(4, Math.min(y - h / 2, height - 34 - h))];
          return [
            Math.max(4, Math.min(x - w / 2, width - w - 4)),
            y - h - gap >= 4 ? y - h - gap : Math.min(y + gap, height - 34 - h),
          ];
        },
      },
      series: series.map((s) => ({
        id: s.key,
        name: s.label,
        type: kind,
        data: data.map((d) => valueAt(d, s.key)),
        itemStyle: { color: s.color, borderRadius: kind === 'bar' ? [2, 2, 0, 0] : undefined },
        lineStyle: { color: s.color, width: 2 },
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: data.length <= 7,
        connectNulls: false,
        barMaxWidth: 28,
        emphasis: { scale: 1.8, focus: 'none' },
      })),
    });
    host.querySelector('svg')?.setAttribute('role', 'img');
    host.querySelector('svg')?.setAttribute('aria-label', title);
    let enterable = true;
    const hover = () => {
      if (!enterable) {
        chart.setOption({ tooltip: { enterable: true, hideDelay: 100 } });
        enterable = true;
      }
    };
    const show = (next: number) => {
      hover();
      index.current = Math.max(0, Math.min(data.length - 1, next));
      const x = chart.convertToPixel({ xAxisIndex: 0 }, index.current) as number;
      const value = valueAt(data[index.current], series[0].key);
      const y = value === null ? 90 : (chart.convertToPixel({ yAxisIndex: 0 }, value) as number);
      chart.dispatchAction({ type: 'showTip', x, y });
    };
    const hide = () => {
      chart.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
      chart.dispatchAction({ type: 'hideTip' });
      // Clear the native inspection first, then dismiss even when the pointer is inside the tip.
      if (enterable) {
        chart.setOption({ tooltip: { enterable: false, hideDelay: 0 } });
        enterable = false;
      }
      chart.dispatchAction({ type: 'hideTip' });
      host.removeAttribute('aria-describedby');
    };
    control.current = {
      show,
      hide,
      hover,
      pick: (x, y) => {
        hover();
        chart.dispatchAction({ type: 'showTip', x, y });
      },
    };
    chart.on('hideTip', () => host.removeAttribute('aria-describedby'));
    const outside = (event: globalThis.PointerEvent) => {
      if (!frame.current?.contains(event.target as Node)) hide();
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    const observer = new ResizeObserver(() => {
      hide();
      chart.resize();
    });
    observer.observe(host);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      host.removeAttribute('aria-describedby');
      control.current = null;
      chart.dispose();
    };
  }, [spec, id]);
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = {
      ArrowLeft: index.current - 1,
      ArrowRight: index.current + 1,
      Home: 0,
      End: data.length - 1,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      control.current?.show(next);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      control.current?.hide();
    }
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    const start = press.current;
    press.current = null;
    if (event.pointerType === 'mouse' || !start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 10) {
      dragged.current = true;
      control.current?.hide();
    } else {
      const bounds = event.currentTarget.getBoundingClientRect();
      control.current?.pick(event.clientX - bounds.left, event.clientY - bounds.top);
    }
  };
  return (
    <div ref={frame} className="chart-frame">
      {!data.length ? (
        <p className="muted">这段时间没有可用的图表数据。</p>
      ) : (
        <div
          ref={surface}
          className="chart-plot"
          role="group"
          tabIndex={0}
          aria-label={`${title}，${data.length}个日期；左右键逐日查看，Home/End到首末日，Esc关闭提示`}
          onKeyDown={keyboard}
          onFocus={() => {
            if (!press.current) control.current?.show(data.length - 1);
          }}
          onBlur={() => control.current?.hide()}
          onPointerMove={() => control.current?.hover()}
          onPointerDown={(event) => {
            dragged.current = false;
            press.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={release}
          onTouchEnd={() => {
            // Native chart touchend synthesizes a mouse move; finish drag dismissal after it.
            if (dragged.current) control.current?.hide();
          }}
          onPointerCancel={() => {
            dragged.current = true;
            press.current = null;
            control.current?.hide();
          }}
        />
      )}
    </div>
  );
}
