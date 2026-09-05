import type { ReactNode } from "react";

interface LineSeries {
  label: string;
  values: number[];
  colour: string;
  dashed?: boolean;
}

interface LineChartProps {
  series: LineSeries[];
  activeIndex?: number;
  height?: number;
  logScale?: boolean;
  onSelect?: (index: number) => void;
  emptyLabel?: string;
}

export function LineChart({
  series,
  activeIndex,
  height = 160,
  logScale = false,
  onSelect,
  emptyLabel = "No data",
}: LineChartProps) {
  const width = 720;
  const padding = { top: 14, right: 12, bottom: 22, left: 12 };
  const transformed = series.map((item) => ({
    ...item,
    values: item.values.map((value) => logScale ? Math.log10(Math.max(value, Number.EPSILON)) : value),
  }));
  const allValues = transformed.flatMap((item) => item.values).filter(Number.isFinite);
  const length = Math.max(0, ...transformed.map((item) => item.values.length));
  if (allValues.length === 0 || length === 0) return <div className="empty-chart">{emptyLabel}</div>;
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (min === max) { min -= 1; max += 1; }
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (index / Math.max(1, length - 1)) * innerWidth;
  const y = (value: number) => padding.top + (1 - (value - min) / (max - min)) * innerHeight;

  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => (
          <line key={ratio} x1={padding.left} x2={width - padding.right} y1={padding.top + ratio * innerHeight} y2={padding.top + ratio * innerHeight} className="chart-grid" />
        ))}
        {activeIndex !== undefined && (
          <line x1={x(activeIndex)} x2={x(activeIndex)} y1={padding.top} y2={height - padding.bottom} className="chart-playhead" />
        )}
        {transformed.map((item) => {
          const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
          return <polyline key={item.label} points={points} fill="none" stroke={item.colour} strokeWidth="2" strokeDasharray={item.dashed ? "6 5" : undefined} vectorEffect="non-scaling-stroke" />;
        })}
        {onSelect && Array.from({ length }, (_, index) => (
          <rect key={index} x={x(index) - innerWidth / Math.max(1, length) / 2} y={padding.top} width={innerWidth / Math.max(1, length)} height={innerHeight} fill="transparent" onClick={() => onSelect(index)} className="chart-hit" />
        ))}
        <text x={padding.left} y={height - 5} className="chart-axis-label">0</text>
        <text x={width - padding.right} y={height - 5} textAnchor="end" className="chart-axis-label">{length - 1}</text>
      </svg>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((item) => <span key={item.label}><i style={{ background: item.colour }} />{item.label}</span>)}
        </div>
      )}
    </div>
  );
}

export function MetricBar({ value, max, colour = "var(--accent)" }: { value: number; max: number; colour?: string }) {
  const width = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  return <div className="metric-bar"><span style={{ width: `${width}%`, background: colour }} /></div>;
}

export function Panel({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
        {action}
      </header>
      {children}
    </section>
  );
}
