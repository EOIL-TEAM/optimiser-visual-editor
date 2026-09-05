import { Activity, AlertTriangle, CheckCircle2, GitCompareArrows, Layers3 } from "lucide-react";
import { useMemo } from "react";
import type { OptimizerRun, PassageDefinition } from "../types";
import { formatNumber, optimizerLabel, representationLabel } from "../lib/format";
import { simulatePassage } from "../lib/physics";
import { LineChart, Panel } from "./Charts";

interface Props {
  runs: OptimizerRun[];
  passage: PassageDefinition;
  representation: string;
  onRepresentation: (value: string) => void;
  onOpenRun: (id: string, index?: number) => void;
}

const COLOURS: Record<string, string> = { sorf: "#ffb357", bfgs: "#7bdff2", steepest_descent: "#c4b5fd" };

export function CompareView({ runs, passage, representation, onRepresentation, onOpenRun }: Props) {
  const availableRepresentations = [...new Set(runs.map((run) => run.representation))];
  const selected = runs.filter((run) => run.representation === representation);
  const flights = useMemo(() => selected.map((run) => ({ run, samples: simulatePassage(run.trace.at(-1)?.native_after ?? [], passage) })), [selected, passage]);
  return (
    <main className="compare-view scrollable">
      <div className="view-intro">
        <div><span className="eyebrow">Comparison room</span><h1>Same problem. Different search behaviour.</h1><p>Compare retained objective, physical consequence and failure mode under an identical representation.</p></div>
        <div className="segmented-control">
          {availableRepresentations.map((value) => <button key={value} className={representation === value ? "active" : ""} onClick={() => onRepresentation(value)}>{representationLabel(value)}</button>)}
        </div>
      </div>
      <div className="compare-cards">
        {selected.map((run) => {
          const initial = run.trace[0]?.value_before ?? run.final_value;
          const reduction = 100 * (1 - run.final_value / initial);
          const elections = run.trace.filter((frame) => frame.elected).length;
          const failed = run.stop_reason === "line_search_failed";
          return (
            <button className="compare-card" key={run.id} onClick={() => onOpenRun(run.id)}>
              <div className="compare-card-title"><span className={`optimizer-mark optimizer-${run.optimizer}`}>{run.optimizer === "sorf" ? <Activity /> : run.optimizer === "bfgs" ? <GitCompareArrows /> : <Layers3 />}</span><div><small>Optimiser</small><strong>{optimizerLabel(run.optimizer)}</strong></div><span className={`outcome-chip ${failed ? "failure" : "success"}`}>{failed ? <AlertTriangle /> : <CheckCircle2 />}{failed ? "Stopped" : "Complete"}</span></div>
              <div className="compare-primary-value"><strong>{formatNumber(run.final_value, 5)}</strong><small>final objective</small></div>
              <div className="compare-stat-row"><span>Reduction <b>{formatNumber(reduction, 1)}%</b></span><span>Evaluations <b>{run.objective_evaluations}</b></span><span>Elections <b>{elections}</b></span></div>
              <div className="micro-chart"><LineChart height={70} logScale series={[{ label: optimizerLabel(run.optimizer), values: [initial, ...run.trace.map((frame) => frame.value_after)], colour: COLOURS[run.optimizer] ?? "#fff" }]} /></div>
            </button>
          );
        })}
      </div>
      <div className="compare-grid">
        <Panel title="Objective convergence" eyebrow="Optimiser time" className="compare-objective">
          <LineChart height={250} logScale series={selected.map((run) => ({ label: optimizerLabel(run.optimizer), values: [run.trace[0]?.value_before ?? run.final_value, ...run.trace.map((frame) => frame.value_after)], colour: COLOURS[run.optimizer] ?? "#fff" }))} />
        </Panel>
        <Panel title="Final system passage" eyebrow="Application space" className="compare-flight-panel">
          <ComparisonFlight flights={flights} passage={passage} />
        </Panel>
      </div>
      <Panel title="Representation-sensitive outcomes" eyebrow="Evidence matrix">
        <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Optimiser</th><th>Representation</th><th>Final objective</th><th>Iterations</th><th>Max condition</th><th>Lifecycle</th></tr></thead><tbody>
          {runs.map((run) => <tr key={run.id} onClick={() => onOpenRun(run.id)}><td><i style={{ background: COLOURS[run.optimizer] }} />{optimizerLabel(run.optimizer)}</td><td>{representationLabel(run.representation)}</td><td>{formatNumber(run.final_value)}</td><td>{run.trace.length}</td><td>{formatNumber(Math.max(...run.trace.map((frame) => frame.metric_after.condition_number)))}</td><td><span className={run.stop_reason === "line_search_failed" ? "danger-text" : "success-text"}>{run.stop_reason === "line_search_failed" ? "Line search stopped" : "Passage completed"}</span></td></tr>)}
        </tbody></table></div>
      </Panel>
    </main>
  );
}

function ComparisonFlight({ flights, passage }: { flights: { run: OptimizerRun; samples: ReturnType<typeof simulatePassage> }[]; passage: PassageDefinition }) {
  const width = 720, height = 250, pad = 30;
  const all = flights.flatMap((item) => item.samples);
  const xs = [...all.map((item) => item.x), passage.target_state[0], passage.initial_state[0]];
  const zs = [...all.map((item) => item.z), passage.target_state[1], passage.initial_state[1], 0];
  const minX = Math.min(...xs) - 0.3, maxX = Math.max(...xs) + 0.3, minZ = Math.min(...zs) - 0.2, maxZ = Math.max(...zs) + 0.35;
  const x = (value: number) => pad + (value - minX) / Math.max(0.1, maxX - minX) * (width - 2 * pad);
  const y = (value: number) => height - pad - (value - minZ) / Math.max(0.1, maxZ - minZ) * (height - 2 * pad);
  return <svg className="comparison-flight" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
    {[0, 0.5, 1].map((ratio) => <line key={ratio} x1={pad} x2={width - pad} y1={pad + ratio * (height - 2 * pad)} y2={pad + ratio * (height - 2 * pad)} className="chart-grid" />)}
    {flights.map(({ run, samples }) => <polyline key={run.id} points={samples.map((item) => `${x(item.x)},${y(item.z)}`).join(" ")} fill="none" stroke={COLOURS[run.optimizer] ?? "#fff"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}
    <g transform={`translate(${x(passage.target_state[0])} ${y(passage.target_state[1])})`} className="target-marker"><circle r="12" /><circle r="3" /></g>
  </svg>;
}
