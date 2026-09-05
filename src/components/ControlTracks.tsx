import type { FlightSample, PassageDefinition } from "../types";
import { formatNumber } from "../lib/format";
import { Panel } from "./Charts";

interface Props {
  samples: FlightSample[];
  passage: PassageDefinition;
  timeIndex: number;
  onTimeIndex: (value: number) => void;
}

export function ControlTracks({ samples, passage, timeIndex, onTimeIndex }: Props) {
  const controls = samples.slice(0, passage.horizon);
  const channels = [
    { key: "collective" as const, label: "Collective thrust", unit: "N", colour: "#ffb357" },
    { key: "torque" as const, label: "Pitch torque", unit: "N·m", colour: "#7bdff2" },
    { key: "leftForce" as const, label: "Left rotor", unit: "N", colour: "#a7f3d0" },
    { key: "rightForce" as const, label: "Right rotor", unit: "N", colour: "#c4b5fd" },
  ];
  return (
    <Panel title="Control programme" eyebrow="Native variables" className="control-panel" action={<span className="panel-badge">{passage.horizon} × 2 structured dimensions</span>}>
      <div className="control-tracks">
        {channels.map((channel) => {
          const values = controls.map((sample) => sample[channel.key]);
          const maxAbs = Math.max(0.001, ...values.map(Math.abs));
          return (
            <div className="control-track" key={channel.key}>
              <div className="track-label"><span style={{ background: channel.colour }} /><div><strong>{channel.label}</strong><small>{formatNumber(values[Math.min(timeIndex, values.length - 1)], 3)} {channel.unit}</small></div></div>
              <div className="track-cells">
                {values.map((value, index) => {
                  const intensity = 0.14 + 0.78 * Math.abs(value) / maxAbs;
                  return <button key={index} aria-label={`${channel.label} at ${formatNumber(index * passage.dt, 2)} seconds`} className={index === timeIndex ? "active" : ""} style={{ backgroundColor: hexToRgba(channel.colour, intensity) }} onClick={() => onTimeIndex(index)} />;
                })}
                <i className="track-playhead" style={{ left: `${(timeIndex / Math.max(1, values.length - 1)) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="track-axis"><span>0.00 s</span><span>System time →</span><span>{formatNumber(passage.horizon * passage.dt, 2)} s</span></div>
    </Panel>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
