import { Activity, AlertTriangle, Box, CheckCircle2, ChevronDown, GitCompareArrows, Layers3 } from "lucide-react";
import type { OptimizerRun, PassageDefinition, WorkspaceData } from "../types";
import { formatNumber, optimizerLabel, representationLabel } from "../lib/format";

interface Props {
  workspace: WorkspaceData;
  passage: PassageDefinition;
  run: OptimizerRun;
  onPassage: (id: string) => void;
  onRun: (id: string) => void;
}

export function RunSidebar({ workspace, passage, run, onPassage, onRun }: Props) {
  const passageRuns = workspace.runs.filter((item) => item.passage === passage.id);
  return (
    <aside className="run-sidebar">
      <div className="sidebar-section">
        <span className="eyebrow">Problem</span>
        <label className="select-shell">
          <Box size={15} />
          <select value={passage.id} onChange={(event) => onPassage(event.target.value)} aria-label="Select passage">
            {workspace.passages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <p className="sidebar-description">{passage.purpose}</p>
        <div className="problem-facts">
          <span><b>{passage.horizon * 2}</b> variables</span>
          <span><b>{formatNumber(passage.horizon * passage.dt, 2)} s</b> system time</span>
        </div>
      </div>

      <div className="sidebar-section run-list-section">
        <div className="section-title-row"><span className="eyebrow">Recorded runs</span><small>{passageRuns.length}</small></div>
        <div className="run-list">
          {passageRuns.map((item) => {
            const selected = item.id === run.id;
            const failed = item.stop_reason === "line_search_failed";
            const elections = item.trace.filter((frame) => frame.elected).length;
            return (
              <button key={item.id} className={`run-card ${selected ? "selected" : ""}`} onClick={() => onRun(item.id)}>
                <span className={`optimizer-mark optimizer-${item.optimizer}`}>
                  {item.optimizer === "sorf" ? <Activity size={15} /> : item.optimizer === "bfgs" ? <GitCompareArrows size={15} /> : <Layers3 size={15} />}
                </span>
                <span className="run-card-copy">
                  <strong>{optimizerLabel(item.optimizer)}</strong>
                  <small>{representationLabel(item.representation)}</small>
                </span>
                <span className="run-card-result">
                  <b>{formatNumber(item.final_value)}</b>
                  <small className={failed ? "danger-text" : "success-text"}>
                    {failed ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                    {failed ? "Stopped" : "Complete"}
                  </small>
                </span>
                {elections > 0 && <span className="election-count">{elections}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <span className="status-dot" />
        <div><strong>Evidence workspace</strong><small>{workspace.runs.length} deterministic traces</small></div>
      </div>
    </aside>
  );
}
