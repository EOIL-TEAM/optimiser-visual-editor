import { AlertTriangle, ArrowDownRight, CheckCircle2, CircleDot, GitCommitHorizontal, Info, ScanLine } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import type { ObjectiveBreakdown, TraceFrame } from "../types";
import { compactVector, formatNumber, humanize } from "../lib/format";
import { MetricBar } from "./Charts";

interface Props {
  frame: TraceFrame;
  breakdown: ObjectiveBreakdown;
}

export function Inspector({ frame, breakdown }: Props) {
  const [tab, setTab] = useState<"decision" | "objective" | "evidence">("decision");
  const event = !frame.adopted ? "Line search failed" : frame.elected ? "Candidate elected" : frame.refused ? "Candidate refused" : frame.nominated ? "Candidate nominated" : "Movement adopted";
  const eventTone = !frame.adopted ? "danger" : frame.elected ? "accent" : frame.refused ? "warning" : "success";
  return (
    <aside className="inspector">
      <div className="inspector-tabs">
        {(["decision", "objective", "evidence"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{humanize(item)}</button>)}
      </div>
      {tab === "decision" && (
        <div className="inspector-content">
          <div className={`event-summary ${eventTone}`}>
            <span>{!frame.adopted ? <AlertTriangle /> : frame.elected ? <GitCommitHorizontal /> : frame.nominated ? <CircleDot /> : <CheckCircle2 />}</span>
            <div><small>Iteration {frame.iteration}</small><strong>{event}</strong></div>
          </div>
          <InspectorSection title="Decision state">
            <Property label="Standing" value={humanize(frame.standing)} />
            <Property label="Adopted" value={frame.adopted ? "Yes" : "No"} tone={frame.adopted ? "success" : "danger"} />
            <Property label="Step α" value={formatNumber(frame.alpha, 6)} />
            <Property label="Direction norm" value={formatNumber(frame.direction_norm)} />
            <Property label="Native movement" value={formatNumber(frame.native_movement_norm)} />
          </InspectorSection>
          <InspectorSection title="Metric state">
            <Property label="Condition number" value={formatNumber(frame.metric_after.condition_number)} tone={frame.metric_after.condition_number > 1e7 ? "danger" : frame.metric_after.condition_number > 1e5 ? "warning" : undefined} />
            <div className="spectrum-line"><span style={{ left: spectrumPosition(frame.metric_after.minimum_eigenvalue) }} /><i /><span style={{ left: spectrumPosition(frame.metric_after.maximum_eigenvalue) }} /></div>
            <div className="spectrum-labels"><small>λ min {formatNumber(frame.metric_after.minimum_eigenvalue)}</small><small>λ max {formatNumber(frame.metric_after.maximum_eigenvalue)}</small></div>
          </InspectorSection>
          {frame.scores && (
            <InspectorSection title="Parent-referenced ordeal">
              <div className="score-comparison">
                <div><small>Parent residual</small><strong>{formatNumber(frame.scores.parent, 6)}</strong><MetricBar value={frame.scores.parent} max={Math.max(frame.scores.parent, frame.scores.child)} colour="#7c8597" /></div>
                <ArrowDownRight size={16} />
                <div><small>Child residual</small><strong>{formatNumber(frame.scores.child, 6)}</strong><MetricBar value={frame.scores.child} max={Math.max(frame.scores.parent, frame.scores.child)} colour="#ffb357" /></div>
              </div>
            </InspectorSection>
          )}
          <InspectorSection title="Line-search ray" badge={`${frame.line_search_trials.length} trials`}>
            <div className="trial-waterfall">
              {frame.line_search_trials.map((trial, index) => {
                const improves = trial.value < frame.value_before;
                const width = Math.max(4, Math.min(100, 8 + 92 * trial.value / Math.max(...frame.line_search_trials.map((item) => item.value), frame.value_before)));
                return <div key={index} className={improves ? "improves" : "rejects"}><small>2<sup>−{index}</sup></small><i><span style={{ width: `${width}%` }} /></i><b>{formatNumber(trial.value)}</b></div>;
              })}
            </div>
          </InspectorSection>
        </div>
      )}
      {tab === "objective" && (
        <div className="inspector-content">
          <div className="objective-total"><small>Reconstructed objective</small><strong>{formatNumber(breakdown.total, 5)}</strong><span>Directly recalculated from the retained native control programme.</span></div>
          <InspectorSection title="Cost constitution">
            <Breakdown label="Terminal state" value={breakdown.terminal} total={breakdown.total} colour="#ffb357" />
            <Breakdown label="Running tracking" value={breakdown.tracking} total={breakdown.total} colour="#7bdff2" />
            <Breakdown label="Actuator limits" value={breakdown.actuator} total={breakdown.total} colour="#fb7185" />
            <Breakdown label="Control effort" value={breakdown.control} total={breakdown.total} colour="#a7f3d0" />
            <Breakdown label="Smoothness" value={breakdown.smoothness} total={breakdown.total} colour="#c4b5fd" />
          </InspectorSection>
          <div className="provenance-note"><Info size={14} /><span>The breakdown is derived for display. The recorded scalar remains the authoritative optimisation judgement.</span></div>
        </div>
      )}
      {tab === "evidence" && (
        <div className="inspector-content">
          <div className="evidence-heading"><ScanLine /><div><small>Structural evidence</small><strong>Section return</strong></div></div>
          <InspectorSection title="Admitted quantities">
            <Vector label="s · displacement" value={frame.s} />
            <Vector label="p · certified return" value={frame.p} />
            <Vector label="r · transverse return" value={frame.r} />
            <Property label="q · metric length²" value={formatNumber(frame.q, 7)} />
          </InspectorSection>
          <InspectorSection title="Provenance flags">
            <Flag label="Movement adopted" active={frame.adopted} />
            <Flag label="Section admitted" active={frame.standing === "ADMITTED_SECTION"} />
            <Flag label="Candidate nominated" active={frame.nominated} />
            <Flag label="Ordeal fired" active={frame.ordeal_fired} />
            <Flag label="Candidate elected" active={frame.elected} />
          </InspectorSection>
          <div className="provenance-note"><Info size={14} /><span>Observed and derived evidence are kept distinct. Visual projection does not constitute a structural claim.</span></div>
        </div>
      )}
    </aside>
  );
}

function InspectorSection({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return <section className="inspector-section"><header><h3>{title}</h3>{badge && <span>{badge}</span>}</header>{children}</section>;
}
function Property({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className="property-row"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}
function Breakdown({ label, value, total, colour }: { label: string; value: number; total: number; colour: string }) {
  return <div className="breakdown-row"><div><span style={{ background: colour }} />{label}<strong>{formatNumber(value)}</strong></div><MetricBar value={value} max={total} colour={colour} /></div>;
}
function Vector({ label, value }: { label: string; value?: number[] | null }) {
  return <div className="vector-row"><small>{label}</small><code>{compactVector(value)}</code></div>;
}
function Flag({ label, active }: { label: string; active: boolean }) {
  return <div className="flag-row"><span className={active ? "active" : ""}>{active ? <CheckCircle2 /> : <CircleDot />}</span>{label}</div>;
}
function spectrumPosition(value: number): string {
  const log = Math.log10(Math.max(1e-15, Math.abs(value)));
  return `${Math.max(0, Math.min(100, ((log + 15) / 30) * 100))}%`;
}
