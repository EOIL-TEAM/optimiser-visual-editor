import { Activity, AlertTriangle, ArrowRight, Beaker, CheckCircle2, ChevronDown, GitBranch, Microscope, Route, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { BranchAnalysis, BranchAnalysisWorkspace, CounterfactualBranch, PassageDefinition, WorkspaceData } from "../types";
import { formatNumber, representationLabel } from "../lib/format";
import { LineChart, MetricBar, Panel } from "./Charts";

const BRANCH_COLOURS: Record<string, string> = {
  elected: "#ff6f83",
  parent: "#7bdff2",
  blend_25: "#78e2b2",
  blend_50: "#ffcf70",
  blend_75: "#ff9f57",
  parent_bfgs: "#b9a6ff",
  candidate_bfgs: "#f472b6",
};

interface Props {
  analyses: BranchAnalysisWorkspace;
  workspace: WorkspaceData;
  onOpenOriginal: (runId: string, iteration: number) => void;
}

export function BranchLab({ analyses, workspace, onOpenOriginal }: Props) {
  const preferred = analyses.analyses.find((item) => item.passage === "short_aggressive" && item.representation === "native" && item.election_iteration === 44) ?? analyses.analyses[0];
  const [analysisId, setAnalysisId] = useState(preferred?.id ?? "");
  const [selectedBranches, setSelectedBranches] = useState<string[]>(["elected", "parent", "blend_25", "parent_bfgs"]);
  const analysis = analyses.analyses.find((item) => item.id === analysisId) ?? preferred;
  const passage = workspace.passages.find((item) => item.id === analysis?.passage);
  if (!analysis || !passage) return <div className="loading-screen"><AlertTriangle /><h1>No branch analysis available</h1></div>;
  const visible = analysis.branches.filter((branch) => selectedBranches.includes(branch.id));
  const elected = analysis.branches.find((branch) => branch.id === "elected")!;
  const parent = analysis.branches.find((branch) => branch.id === "parent")!;
  const best = [...analysis.branches].sort((left, right) => left.final_value - right.final_value)[0];
  const directionAmplification = elected.direction.operative_norm / parent.direction.operative_norm;
  const conditionAmplification = elected.metric.condition_number / parent.metric.condition_number;
  const knownThree = analyses.analyses.find((item) => item.passage === "short_aggressive" && item.representation === "native" && item.election_iteration === 3);
  const knownFortyFour = analyses.analyses.find((item) => item.passage === "short_aggressive" && item.representation === "native" && item.election_iteration === 44);

  const toggleBranch = (id: string) => setSelectedBranches((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <main className="branch-view scrollable">
      <div className="view-intro branch-intro">
        <div><span className="eyebrow">Counterfactual laboratory</span><h1>Freeze once. Continue many ways.</h1><p>Every branch begins from the same recorded post-election state and is replayed through the admitted SORF kernel or declared BFGS update.</p></div>
        <div className="branch-intro-actions">
          <label className="analysis-select"><GitBranch /><span><small>Checkpoint</small><strong>{passage.label} · iteration {analysis.election_iteration}</strong></span><ChevronDown /><select value={analysis.id} onChange={(event) => setAnalysisId(event.target.value)}>{analyses.analyses.map((item) => <option key={item.id} value={item.id}>{workspace.passages.find((passageItem) => passageItem.id === item.passage)?.label ?? item.passage} · {representationLabel(item.representation)} · election {item.election_iteration}</option>)}</select></label>
          <button className="open-original" onClick={() => onOpenOriginal(analysis.run_id, analysis.election_iteration)}>Open original <ArrowRight /></button>
        </div>
      </div>

      <div className="integrity-strip">
        <span className={analysis.reproduction.passed ? "passed" : "failed"}>{analysis.reproduction.passed ? <ShieldCheck /> : <AlertTriangle />}</span>
        <div><strong>{analysis.reproduction.passed ? "Original continuation reproduced exactly" : "Reproduction check failed"}</strong><small>Maximum recorded-value residual {formatNumber(analysis.reproduction.maximum_value_residual, 12)} across {analysis.reproduction.compared_iterations} comparable iterations</small></div>
        <code>{analyses.engine}</code>
      </div>

      {knownThree && knownFortyFour && <DistinguishingPair successful={knownThree} failed={knownFortyFour} onSelect={setAnalysisId} />}

      <div className="branch-selector-row">
        <div><span className="eyebrow">Parallel continuations</span><h2>{analysis.branches.length} branches from one checkpoint</h2></div>
        <div className="branch-pills">{analysis.branches.map((branch) => <button key={branch.id} className={selectedBranches.includes(branch.id) ? "active" : ""} onClick={() => toggleBranch(branch.id)}><i style={{ background: BRANCH_COLOURS[branch.id] }} />{branch.label}</button>)}</div>
      </div>

      <div className="branch-kpis">
        <BranchKpi label="Candidate direction amplification" value={`${formatNumber(directionAmplification, 1)}×`} note="versus retained parent" tone={directionAmplification > 1000 ? "danger" : directionAmplification > 30 ? "warning" : "success"} />
        <BranchKpi label="Condition amplification" value={`${formatNumber(conditionAmplification, 1)}×`} note={`${formatNumber(parent.metric.condition_number)} → ${formatNumber(elected.metric.condition_number)}`} tone={conditionAmplification > 1e5 ? "danger" : conditionAmplification > 100 ? "warning" : "success"} />
        <BranchKpi label="First improving candidate step" value={elected.immediate.first_improving_exponent === null ? "None" : `2⁻${elected.immediate.first_improving_exponent}`} note={elected.immediate.first_improving_exponent !== null && elected.immediate.first_improving_exponent <= 9 ? "inside admitted search" : "outside ten-trial search"} tone={elected.immediate.adopted ? "success" : "danger"} />
        <BranchKpi label="Best 12-step continuation" value={formatNumber(best.final_value)} note={best.label} tone="accent" />
      </div>

      <div className="branch-chart-grid">
        <Panel title="Objective continuation" eyebrow="Multi-iteration consequence" action={<span className="panel-badge">same starting judgement</span>}>
          <LineChart height={245} logScale series={visible.map((branch) => ({ label: branch.label, values: branch.multi.values, colour: BRANCH_COLOURS[branch.id] }))} />
        </Panel>
        <Panel title="Physical-system continuation" eyebrow="Final retained programme" action={<span className="panel-badge">x / altitude / pitch</span>}>
          <BranchTrajectories branches={visible} passage={passage} />
        </Panel>
      </div>

      <div className="branch-chart-grid ray-grid">
        <Panel title="Immediate objective ray" eyebrow="Line-search resolution" action={<span className="panel-badge">α = 2⁻ᵏ · k 0…30</span>}>
          <LineChart height={220} logScale series={visible.map((branch) => ({ label: branch.label, values: branch.immediate.diagnostic_ray_values, colour: BRANCH_COLOURS[branch.id] }))} />
        </Panel>
        <Panel title="Metric spectrum" eyebrow="Geometric consequence" action={<span className="panel-badge">eigenvalue quantiles</span>}>
          <SpectrumComparison branches={visible} />
        </Panel>
      </div>

      <Panel title="Direction programme" eyebrow="High-dimensional structure" className="direction-panel" action={<span className="panel-badge">native collective / torque through system time</span>}>
        <DirectionComparison branches={visible} passage={passage} />
      </Panel>

      <Panel title="Counterfactual decision table" eyebrow="Immediate and multi-iteration outcomes" className="branch-table-panel">
        <div className="comparison-table-wrap"><table className="comparison-table branch-table"><thead><tr><th>Continuation</th><th>Direction</th><th>−g alignment</th><th>g on λmin</th><th>Condition</th><th>First improvement</th><th>Immediate</th><th>12-step objective</th><th>Efficiency</th><th>Terminal error</th><th>Constraints</th></tr></thead><tbody>
          {analysis.branches.map((branch) => <tr key={branch.id} onClick={() => toggleBranch(branch.id)} className={selectedBranches.includes(branch.id) ? "selected" : ""}><td><i style={{ background: BRANCH_COLOURS[branch.id] }} />{branch.label}</td><td>{formatNumber(branch.direction.operative_norm)}</td><td>{formatNumber(branch.direction.cosine_to_negative_gradient, 6)}</td><td>{formatNumber(branch.direction.gradient_alignment_minimum_eigenvector, 6)}</td><td>{formatNumber(branch.metric.condition_number)}</td><td>{branch.immediate.first_improving_exponent === null ? "None" : `2⁻${branch.immediate.first_improving_exponent}`}</td><td><span className={branch.immediate.adopted ? "success-text" : "danger-text"}>{branch.immediate.adopted ? `Adopted · α ${formatNumber(branch.immediate.alpha, 7)}` : "Failed"}</span></td><td>{formatNumber(branch.final_value, 6)}</td><td>{formatNumber(branch.objective_efficiency, 6)}</td><td>{formatNumber(branch.multi.final_system.terminal_position_error, 5)} m</td><td>{branch.multi.final_system.constraint_violation_count}</td></tr>)}
        </tbody></table></div>
      </Panel>

      <MechanismReading analysis={analysis} elected={elected} parent={parent} best={best} />
    </main>
  );
}

function DistinguishingPair({ successful, failed, onSelect }: { successful: BranchAnalysis; failed: BranchAnalysis; onSelect: (id: string) => void }) {
  const successfulCandidate = successful.branches.find((item) => item.id === "elected")!;
  const successfulParent = successful.branches.find((item) => item.id === "parent")!;
  const failedCandidate = failed.branches.find((item) => item.id === "elected")!;
  const failedParent = failed.branches.find((item) => item.id === "parent")!;
  const rows = [
    ["Candidate direction amplification", successfulCandidate.direction.operative_norm / successfulParent.direction.operative_norm, failedCandidate.direction.operative_norm / failedParent.direction.operative_norm, "×"],
    ["Metric condition amplification", successfulCandidate.metric.condition_number / successfulParent.metric.condition_number, failedCandidate.metric.condition_number / failedParent.metric.condition_number, "×"],
    ["First improving exponent", successfulCandidate.immediate.first_improving_exponent ?? 31, failedCandidate.immediate.first_improving_exponent ?? 31, ""],
    ["Candidate continuation objective", successfulCandidate.final_value, failedCandidate.final_value, ""],
  ] as const;
  return <section className="distinguishing-pair"><header><div><span className="eyebrow">Known paired ordeal</span><h2>What separates survival from immediate failure?</h2></div><span>Same optimiser · same passage · same representation</span></header><div className="pair-columns"><button onClick={() => onSelect(successful.id)}><span className="pair-status success"><CheckCircle2 />Iteration 3 · survived</span><strong>Useful enough to continue</strong><small>The candidate fits inside the admitted search, though retaining the parent remains more efficient over the replay horizon.</small></button><div className="pair-differences">{rows.map(([label, left, right, suffix]) => <div key={label}><span>{label}</span><b>{formatNumber(left)}{suffix}</b><i><ArrowRight /></i><b className={right / Math.max(left, Number.EPSILON) > 100 ? "danger-text" : ""}>{formatNumber(right)}{suffix}</b></div>)}</div><button onClick={() => onSelect(failed.id)}><span className="pair-status danger"><AlertTriangle />Iteration 44 · failed</span><strong>Scale overwhelms resolution</strong><small>The candidate amplifies the direction by nearly four orders of magnitude and pushes improvement to 2⁻²⁰.</small></button></div></section>;
}

function BranchKpi({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <div className={`branch-kpi ${tone}`}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>;
}

function SpectrumComparison({ branches }: { branches: CounterfactualBranch[] }) {
  const logs = branches.flatMap((branch) => branch.metric.eigenvalue_quantiles.map((value) => Math.log10(Math.max(value, 1e-30))));
  const min = Math.min(...logs), max = Math.max(...logs);
  return <div className="spectrum-comparison">{branches.map((branch) => <div key={branch.id}><span><i style={{ background: BRANCH_COLOURS[branch.id] }} />{branch.label}</span><div>{branch.metric.eigenvalue_quantiles.map((value, index) => <b key={index} style={{ left: `${100 * (Math.log10(Math.max(value, 1e-30)) - min) / Math.max(1e-12, max - min)}%`, background: BRANCH_COLOURS[branch.id] }} />)}</div><small>{formatNumber(branch.metric.minimum_eigenvalue)} → {formatNumber(branch.metric.maximum_eigenvalue)}</small></div>)}</div>;
}

function DirectionComparison({ branches, passage }: { branches: CounterfactualBranch[]; passage: PassageDefinition }) {
  return <div className="direction-comparison">{branches.map((branch) => {
    const values = branch.direction.native_components;
    const collective = Array.from({ length: passage.horizon }, (_, index) => values[index * 2] ?? 0);
    const torque = Array.from({ length: passage.horizon }, (_, index) => values[index * 2 + 1] ?? 0);
    const max = Math.max(1e-12, ...values.map(Math.abs));
    return <div className="direction-branch" key={branch.id}><span><i style={{ background: BRANCH_COLOURS[branch.id] }} />{branch.label}<small>‖d‖ {formatNumber(branch.direction.native_norm)}</small></span><div><label>thrust</label><div>{collective.map((value, index) => <b key={index} style={{ opacity: .15 + .85 * Math.abs(value) / max, background: value >= 0 ? BRANCH_COLOURS[branch.id] : "#7bdff2" }} />)}</div></div><div><label>torque</label><div>{torque.map((value, index) => <b key={index} style={{ opacity: .15 + .85 * Math.abs(value) / max, background: value >= 0 ? BRANCH_COLOURS[branch.id] : "#7bdff2" }} />)}</div></div></div>;
  })}</div>;
}

function BranchTrajectories({ branches, passage }: { branches: CounterfactualBranch[]; passage: PassageDefinition }) {
  const width = 720, height = 245, pad = 30;
  const all = branches.flatMap((branch) => branch.multi.final_system.trajectory);
  const xs = [...all.map((state) => state[0]), passage.target_state[0], passage.initial_state[0]];
  const zs = [...all.map((state) => state[1]), passage.target_state[1], passage.initial_state[1], 0];
  const minX = Math.min(...xs) - .25, maxX = Math.max(...xs) + .25, minZ = Math.min(...zs) - .2, maxZ = Math.max(...zs) + .3;
  const x = (value: number) => pad + (value - minX) / Math.max(.1, maxX - minX) * (width - 2 * pad);
  const y = (value: number) => height - pad - (value - minZ) / Math.max(.1, maxZ - minZ) * (height - 2 * pad);
  return <svg className="branch-trajectories" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">{[0,.5,1].map((ratio) => <line key={ratio} x1={pad} x2={width-pad} y1={pad+ratio*(height-2*pad)} y2={pad+ratio*(height-2*pad)} className="chart-grid" />)}{branches.map((branch) => <polyline key={branch.id} points={branch.multi.final_system.trajectory.map((state) => `${x(state[0])},${y(state[1])}`).join(" ")} fill="none" stroke={BRANCH_COLOURS[branch.id]} strokeWidth="2.3" vectorEffect="non-scaling-stroke" />)}<g transform={`translate(${x(passage.target_state[0])} ${y(passage.target_state[1])})`} className="target-marker"><circle r="11"/><circle r="3"/></g></svg>;
}

function MechanismReading({ analysis, elected, parent, best }: { analysis: BranchAnalysis; elected: CounterfactualBranch; parent: CounterfactualBranch; best: CounterfactualBranch }) {
  const directionRatio = elected.direction.operative_norm / parent.direction.operative_norm;
  const searchMiss = elected.immediate.first_improving_exponent !== null && elected.immediate.first_improving_exponent > 9;
  return <section className="mechanism-reading"><span><Microscope /></span><div><small>Mechanism reading · observed counterfactual</small><h2>{searchMiss ? "The elected geometry still descends, but its induced scale defeats the admitted search." : "The elected continuation remains reachable by the admitted search."}</h2><p>The candidate changes direction magnitude by <b>{formatNumber(directionRatio, 2)}×</b> relative to the parent. Its directional derivative is <b>{formatNumber(elected.direction.directional_derivative)}</b>, so it remains mathematical descent. {searchMiss ? `Its first improving dyadic step is 2⁻${elected.immediate.first_improving_exponent}, beyond the official 2⁻⁹ boundary.` : `Improvement begins at 2⁻${elected.immediate.first_improving_exponent}.`} Over the replay horizon, <b>{best.label}</b> reaches the best recorded objective of <b>{formatNumber(best.final_value, 6)}</b>.</p><em>This identifies a scale-versus-resolution mechanism; it does not by itself authorise a condition-number gate or SORF modification.</em></div><span className={`mechanism-outcome ${analysis.outcome === "failed_next_extension" ? "danger" : "success"}`}><Activity />{analysis.outcome === "failed_next_extension" ? "Immediate failure" : "Continuation survived"}</span></section>;
}
