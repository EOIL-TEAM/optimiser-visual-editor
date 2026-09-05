import { Crosshair, Gauge, RotateCw, Timer, Wind } from "lucide-react";
import type { ReactNode } from "react";
import type { FlightSample, PassageDefinition } from "../types";
import { formatNumber } from "../lib/format";

interface Props {
  samples: FlightSample[];
  passage: PassageDefinition;
  timeIndex: number;
  onTimeIndex: (value: number) => void;
}

export function FlightViewport({ samples, passage, timeIndex, onTimeIndex }: Props) {
  const sample = samples[Math.min(timeIndex, samples.length - 1)] ?? samples[0];
  const xs = [...samples.map((item) => item.x), passage.target_state[0], passage.initial_state[0]];
  const zs = [...samples.map((item) => item.z), passage.target_state[1], passage.initial_state[1], 0];
  const minX = Math.min(...xs) - 0.45;
  const maxX = Math.max(...xs) + 0.45;
  const minZ = Math.min(...zs) - 0.3;
  const maxZ = Math.max(...zs) + 0.55;
  const width = 900;
  const height = 430;
  const pad = 44;
  const px = (value: number) => pad + ((value - minX) / Math.max(0.1, maxX - minX)) * (width - 2 * pad);
  const py = (value: number) => height - pad - ((value - minZ) / Math.max(0.1, maxZ - minZ)) * (height - 2 * pad);
  const path = samples.slice(0, timeIndex + 1).map((item, index) => `${index === 0 ? "M" : "L"}${px(item.x)} ${py(item.z)}`).join(" ");
  const futurePath = samples.map((item, index) => `${index === 0 ? "M" : "L"}${px(item.x)} ${py(item.z)}`).join(" ");
  const forceViolation = sample.leftForce < 0 || sample.rightForce < 0 || sample.leftForce > 9.81 || sample.rightForce > 9.81;

  return (
    <div className="flight-viewport">
      <div className="viewport-stage">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Quadrotor flight playback">
          <defs>
            <pattern id="flightGrid" width="45" height="45" patternUnits="userSpaceOnUse">
              <path d="M 45 0 L 0 0 0 45" fill="none" stroke="#ffffff" strokeOpacity="0.045" strokeWidth="1" />
            </pattern>
            <filter id="droneGlow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width={width} height={height} fill="url(#flightGrid)" />
          <line x1={pad} x2={width - pad} y1={py(0)} y2={py(0)} className="ground-line" />
          <path d={futurePath} className="future-flight-path" />
          <path d={path} className="active-flight-path" />
          <g transform={`translate(${px(passage.target_state[0])} ${py(passage.target_state[1])})`} className="target-marker">
            <circle r="20" /><circle r="5" /><path d="M-28 0H28M0-28V28" />
          </g>
          <g transform={`translate(${px(sample.x)} ${py(sample.z)}) rotate(${(-sample.pitch * 180) / Math.PI})`} className={forceViolation ? "drone warning" : "drone"}>
            <circle r="27" className="drone-glow" filter="url(#droneGlow)" />
            <path d="M-31 0H31" className="drone-arm" />
            <rect x="-12" y="-6" width="24" height="12" rx="4" className="drone-body" />
            <ellipse cx="-31" cy="-4" rx="17" ry="3" className="rotor" />
            <ellipse cx="31" cy="-4" rx="17" ry="3" className="rotor" />
            <path d={`M-31 3V${8 + Math.min(20, Math.max(0, sample.leftForce))}`} className="thrust-vector" />
            <path d={`M31 3V${8 + Math.min(20, Math.max(0, sample.rightForce))}`} className="thrust-vector" />
          </g>
          <g className="viewport-label" transform={`translate(${px(sample.x) + 38} ${py(sample.z) - 20})`}>
            <rect width="112" height="37" rx="7" />
            <text x="10" y="15">x {formatNumber(sample.x, 2)} m</text>
            <text x="10" y="29">z {formatNumber(sample.z, 2)} m</text>
          </g>
          <text x={pad} y={24} className="viewport-axis">SYSTEM SPACE · METRES</text>
          <text x={width - pad} y={24} textAnchor="end" className="viewport-time">t = {formatNumber(sample.time, 2)} s</text>
        </svg>
      </div>
      <div className="system-scrubber">
        <Timer size={14} />
        <span>0.00 s</span>
        <input type="range" min={0} max={Math.max(0, samples.length - 1)} value={timeIndex} onChange={(event) => onTimeIndex(Number(event.target.value))} aria-label="System time" />
        <span>{formatNumber((samples.length - 1) * passage.dt, 2)} s</span>
      </div>
      <div className="flight-readouts">
        <Readout icon={<Crosshair size={14} />} label="Position" value={`${formatNumber(sample.x, 2)}, ${formatNumber(sample.z, 2)} m`} />
        <Readout icon={<RotateCw size={14} />} label="Pitch" value={`${formatNumber((sample.pitch * 180) / Math.PI, 2)}°`} />
        <Readout icon={<Wind size={14} />} label="Velocity" value={`${formatNumber(Math.hypot(sample.vx, sample.vz), 2)} m/s`} />
        <Readout icon={<Gauge size={14} />} label="Rotor force" value={`${formatNumber(sample.leftForce, 2)} / ${formatNumber(sample.rightForce, 2)} N`} warning={forceViolation} />
      </div>
    </div>
  );
}

function Readout({ icon, label, value, warning }: { icon: ReactNode; label: string; value: string; warning?: boolean }) {
  return <div className={`flight-readout ${warning ? "warning" : ""}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}
