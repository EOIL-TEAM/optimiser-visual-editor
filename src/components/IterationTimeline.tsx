import { AlertTriangle, Check, CircleDot, GitCommitHorizontal, Play, SkipBack, SkipForward } from "lucide-react";
import type { OptimizerRun } from "../types";
import { formatNumber } from "../lib/format";

interface Props {
  run: OptimizerRun;
  index: number;
  onIndex: (value: number) => void;
  playing: boolean;
  onPlaying: (value: boolean) => void;
}

export function IterationTimeline({ run, index, onIndex, playing, onPlaying }: Props) {
  const frame = run.trace[index];
  return (
    <section className="iteration-timeline">
      <div className="timeline-controls">
        <button onClick={() => onIndex(Math.max(0, index - 1))} title="Previous iteration"><SkipBack size={15} /></button>
        <button className={`play-button ${playing ? "active" : ""}`} onClick={() => onPlaying(!playing)} title={playing ? "Pause" : "Play system passage"}><Play size={15} fill="currentColor" /></button>
        <button onClick={() => onIndex(Math.min(run.trace.length - 1, index + 1))} title="Next iteration"><SkipForward size={15} /></button>
      </div>
      <div className="iteration-counter"><small>Optimiser iteration</small><strong>{String(index).padStart(2, "0")} <span>/ {String(run.trace.length - 1).padStart(2, "0")}</span></strong></div>
      <div className="timeline-track-wrap">
        <div className="timeline-events">
          {run.trace.map((item, itemIndex) => {
            const left = (itemIndex / Math.max(1, run.trace.length - 1)) * 100;
            const kind = !item.adopted ? "failure" : item.elected ? "election" : item.refused ? "refusal" : item.nominated ? "nomination" : "adopted";
            return (
              <button key={itemIndex} className={`timeline-event ${kind} ${itemIndex === index ? "selected" : ""}`} style={{ left: `${left}%` }} onClick={() => onIndex(itemIndex)} title={`Iteration ${itemIndex}: ${kind}`}>
                {kind === "failure" ? <AlertTriangle /> : kind === "election" ? <GitCommitHorizontal /> : kind === "nomination" ? <CircleDot /> : <Check />}
              </button>
            );
          })}
        </div>
        <input type="range" min={0} max={Math.max(0, run.trace.length - 1)} value={index} onChange={(event) => onIndex(Number(event.target.value))} aria-label="Optimiser iteration" />
        <div className="timeline-ticks"><span>Start</span><span>Nomination</span><span>Election</span><span>Failure</span></div>
      </div>
      <div className="timeline-value"><small>Retained objective</small><strong>{formatNumber(frame?.value_after)}</strong></div>
    </section>
  );
}
