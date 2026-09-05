import { AlertTriangle, ArrowRight, CheckCircle2, GitBranch, ScanSearch, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { OptimizerRun, PassageDefinition, WorkspaceData } from "../types";
import { formatNumber, optimizerLabel, representationLabel } from "../lib/format";

interface Props {
  workspace: WorkspaceData;
  onOpenRun: (id: string, iteration?: number) => void;
}

export function EvidenceView({ workspace, onOpenRun }: Props) {
  const events = workspace.runs.flatMap((run) => run.trace.map((frame) => ({ run, frame }))).filter(({ frame }) => frame.elected || !frame.adopted);
  const postElection = events.filter(({ run, frame }) => frame.elected && run.trace[frame.iteration + 1] && !run.trace[frame.iteration + 1].adopted);
  const survived = events.filter(({ run, frame }) => frame.elected && run.trace[frame.iteration + 1]?.adopted);
  const passageById = new Map(workspace.passages.map((passage) => [passage.id, passage]));
  return (
    <main className="evidence-view scrollable">
      <div className="view-intro evidence-intro">
        <div><span className="eyebrow">Evidence room</span><h1>Failures become inspectable events.</h1><p>Observed patterns are gathered here without turning correlations into optimiser law.</p></div>
        <div className="evidence-seal"><ScanSearch /><div><strong>{events.length}</strong><small>decisive events indexed</small></div></div>
      </div>
      <div className="finding-grid">
        <Finding icon={<AlertTriangle />} tone="danger" eyebrow="Recurring failure" title={`${postElection.length} post-election stops`} body="A candidate is elected, its spectrum spreads, and the immediately following ten-trial ray fails to improve." />
        <Finding icon={<CheckCircle2 />} tone="success" eyebrow="Counter-evidence" title={`${survived.length} elections survived`} body="Election alone is not failure. These candidates were followed by at least one adopted extension." />
        <Finding icon={<GitBranch />} tone="accent" eyebrow="Representation" title="Native and linear parity" body="Equivalent fixed-linear runs can be replayed beside native runs while nonlinear representation changes remain visible." />
      </div>
      <section className="event-ledger">
        <header><div><span className="eyebrow">Event ledger</span><h2>Elections and terminal failures</h2></div><span className="panel-badge">Click any row to inspect</span></header>
        <div className="ledger-list">
          {events.map(({ run, frame }) => {
            const passage = passageById.get(run.passage) as PassageDefinition;
            const nextFailed = frame.elected && run.trace[frame.iteration + 1] && !run.trace[frame.iteration + 1].adopted;
            const kind = !frame.adopted ? "Line search failure" : frame.elected ? "Metric election" : "Event";
            return (
              <button key={`${run.id}-${frame.iteration}`} onClick={() => onOpenRun(run.id, frame.iteration)}>
                <span className={`ledger-icon ${!frame.adopted || nextFailed ? "danger" : "success"}`}>{!frame.adopted ? <AlertTriangle /> : nextFailed ? <Sparkles /> : <CheckCircle2 />}</span>
                <span className="ledger-main"><strong>{passage?.label ?? run.passage}</strong><small>{optimizerLabel(run.optimizer)} · {representationLabel(run.representation)}</small></span>
                <span className="ledger-event"><small>Iteration {frame.iteration}</small><strong>{kind}</strong></span>
                <span className="ledger-metric"><small>Condition number</small><strong>{formatNumber(frame.metric_after.condition_number)}</strong></span>
                <span className={`ledger-outcome ${nextFailed || !frame.adopted ? "danger" : "success"}`}>{nextFailed ? "Next extension failed" : !frame.adopted ? "Run stopped" : "Next extension adopted"}</span>
                <ArrowRight />
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Finding({ icon, tone, eyebrow, title, body }: { icon: ReactNode; tone: string; eyebrow: string; title: string; body: string }) {
  return <article className={`finding ${tone}`}><span>{icon}</span><div><small>{eyebrow}</small><h3>{title}</h3><p>{body}</p></div></article>;
}
