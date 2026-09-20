import { Crosshair, Gauge, MapPin, Move3d } from "lucide-react";
import type { ReactNode } from "react";
import type { PassageDefinition, TraceFrame } from "../types";
import { formatNumber } from "../lib/format";

interface Props { passage: PassageDefinition; trace: TraceFrame[]; iteration: number; }

export function evaluateSurface(passage: PassageDefinition, x: number, y: number): number {
  return passage.surface?.function === "rastrigin"
    ? 20 + x * x + y * y - 10 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y))
    : 0.7 * x * x + 1.3 * y * y + 0.35 * x * y;
}

export function SurfaceViewport({ passage, trace, iteration }: Props) {
  const surface = passage.surface!;
  const width = 900, height = 430, steps = 28;
  const points = Array.from({ length: steps + 1 }, (_, iy) => Array.from({ length: steps + 1 }, (_, ix) => {
    const x = surface.x_domain[0] + (ix / steps) * (surface.x_domain[1] - surface.x_domain[0]);
    const y = surface.y_domain[0] + (iy / steps) * (surface.y_domain[1] - surface.y_domain[0]);
    return { x, y, z: evaluateSurface(passage, x, y) };
  }));
  const maxZ = Math.max(...points.flat().map((point) => point.z));
  const project = (x: number, y: number, z: number): [number, number] => {
    const nx = (x - surface.x_domain[0]) / (surface.x_domain[1] - surface.x_domain[0]) - 0.5;
    const ny = (y - surface.y_domain[0]) / (surface.y_domain[1] - surface.y_domain[0]) - 0.5;
    return [width / 2 + (nx - ny) * 520, 315 + (nx + ny) * 145 - (z / Math.max(1, maxZ)) * 205];
  };
  const route = [passage.initial_state, ...trace.slice(0, iteration + 1).map((frame) => frame.native_after)];
  const routePoints = route.map(([x, y]) => project(x, y, evaluateSurface(passage, x, y)));
  const active = route.at(-1)!;
  const activeZ = evaluateSurface(passage, active[0], active[1]);
  return <div className="surface-viewport">
    <div className="viewport-stage"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${passage.label} optimisation surface`}>
      <defs><linearGradient id="surfaceFade" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffb357" stopOpacity=".42"/><stop offset="1" stopColor="#7bdff2" stopOpacity=".08"/></linearGradient></defs>
      {points.map((row, index) => <polyline key={`r${index}`} points={row.map((p) => project(p.x, p.y, p.z).join(",")).join(" ")} className="surface-grid-line" />)}
      {Array.from({ length: steps + 1 }, (_, index) => <polyline key={`c${index}`} points={points.map((row) => project(row[index].x, row[index].y, row[index].z).join(",")).join(" ")} className="surface-grid-line secondary" />)}
      <polyline points={routePoints.map((point) => point.join(",")).join(" ")} className="surface-route" />
      {routePoints.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r={index === routePoints.length - 1 ? 6 : 2.2} className={index === routePoints.length - 1 ? "surface-active" : "surface-step"} />)}
      {(() => { const optimum = project(surface.optimum[0], surface.optimum[1], 0); return <g transform={`translate(${optimum[0]} ${optimum[1]})`} className="surface-optimum"><circle r="13"/><path d="M-18 0H18M0-18V18"/></g>; })()}
      <text x="32" y="28" className="viewport-axis">OBJECTIVE SURFACE · {surface.function.toUpperCase()}</text>
      <text x={width - 32} y="28" textAnchor="end" className="viewport-time">iteration {iteration}</text>
    </svg></div>
    <div className="flight-readouts">
      <Readout icon={<MapPin size={14}/>} label="Position" value={`(${formatNumber(active[0], 3)}, ${formatNumber(active[1], 3)})`} />
      <Readout icon={<Gauge size={14}/>} label="Objective" value={formatNumber(activeZ, 6)} />
      <Readout icon={<Crosshair size={14}/>} label="Distance to optimum" value={formatNumber(Math.hypot(active[0] - surface.optimum[0], active[1] - surface.optimum[1]), 5)} />
      <Readout icon={<Move3d size={14}/>} label="Surface range" value={`${formatNumber(0)} – ${formatNumber(maxZ)}`} />
    </div>
  </div>;
}

function Readout({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flight-readout"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
