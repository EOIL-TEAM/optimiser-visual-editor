import { AlertCircle, BarChart3, ChevronDown, CircleHelp, Columns3, Download, FolderOpen, Gauge, GitBranch, Maximize2, Menu, Mountain, Play, ScanSearch, Settings2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CompareView } from "./components/CompareView";
import { BranchLab } from "./components/BranchLab";
import { ControlTracks } from "./components/ControlTracks";
import { EvidenceView } from "./components/EvidenceView";
import { FlightViewport } from "./components/FlightViewport";
import { SurfaceViewport } from "./components/SurfaceViewport";
import { Inspector } from "./components/Inspector";
import { IterationTimeline } from "./components/IterationTimeline";
import { LineChart, Panel } from "./components/Charts";
import { RunSidebar } from "./components/RunSidebar";
import { loadBranchAnalyses, loadBundledWorkspace, normaliseImportedTrace } from "./lib/data";
import { formatNumber, humanize, optimizerLabel, representationLabel } from "./lib/format";
import { objectiveBreakdown, simulatePassage } from "./lib/physics";
import type { BranchAnalysisWorkspace, MainView, OptimizerRun, WorkspaceData } from "./types";

type CanvasMode = "system" | "search" | "split";

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [branchAnalyses, setBranchAnalyses] = useState<BranchAnalysisWorkspace | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [view, setView] = useState<MainView>("studio");
  const [passageId, setPassageId] = useState("diagonal_sprint");
  const [runId, setRunId] = useState("diagonal_sprint__native__projective_sorf_ls_v1");
  const [iteration, setIteration] = useState(59);
  const [timeIndex, setTimeIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("split");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadBundledWorkspace(), loadBranchAnalyses()]).then(([workspaceData, analysisData]) => {
      setWorkspace(workspaceData);
      setBranchAnalyses(analysisData);
    }).catch((error: Error) => setLoadingError(error.message));
  }, []);

  const passage = useMemo(() => workspace?.passages.find((item) => item.id === passageId) ?? workspace?.passages[0], [workspace, passageId]);
  const run = useMemo(() => workspace?.runs.find((item) => item.id === runId) ?? workspace?.runs.find((item) => item.passage === passage?.id), [workspace, runId, passage]);
  const frame = run?.trace[Math.min(iteration, Math.max(0, run.trace.length - 1))];
  const native = frame?.native_after ?? [];
  const isSurface = passage?.kind === "surface";
  const samples = useMemo(() => passage && !isSurface ? simulatePassage(native, passage) : [], [native, passage, isSurface]);
  const breakdown = useMemo(() => passage && !isSurface && samples.length ? objectiveBreakdown(native, passage, samples) : null, [native, passage, samples, isSurface]);

  const selectPassage = useCallback((id: string) => {
    if (!workspace) return;
    const nextRun = workspace.runs.find((item) => item.passage === id && item.optimizer === "projective_sorf_ls_v1" && item.representation === "native") ?? workspace.runs.find((item) => item.passage === id && item.optimizer === "projective_sorf_ls_v0" && item.representation === "native") ?? workspace.runs.find((item) => item.passage === id);
    setPassageId(id);
    if (nextRun) { setRunId(nextRun.id); setIteration(Math.max(0, nextRun.trace.length - 1)); }
    setTimeIndex(0);
  }, [workspace]);

  const selectRun = useCallback((id: string, requestedIteration?: number) => {
    if (!workspace) return;
    const next = workspace.runs.find((item) => item.id === id);
    if (!next) return;
    setRunId(next.id);
    setPassageId(next.passage);
    setIteration(Math.min(requestedIteration ?? Math.max(0, next.trace.length - 1), Math.max(0, next.trace.length - 1)));
    setTimeIndex(0);
  }, [workspace]);

  useEffect(() => {
    if (!playing || samples.length === 0) return;
    const timer = window.setInterval(() => setTimeIndex((current) => current >= samples.length - 1 ? 0 : current + 1), 65);
    return () => window.clearInterval(timer);
  }, [playing, samples.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === "Space") { event.preventDefault(); setPlaying((value) => !value); }
      if (event.key === "ArrowLeft" && run) setIteration((value) => Math.max(0, value - 1));
      if (event.key === "ArrowRight" && run) setIteration((value) => Math.min(run.trace.length - 1, value + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  useEffect(() => { setTimeIndex(0); }, [iteration, runId]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function importTrace() {
    try {
      let filename = "Imported trace";
      let contents = "";
      if (window.optimiserEditor) {
        const result = await window.optimiserEditor.openTrace();
        if (!result) return;
        filename = result.filePath;
        contents = result.contents;
      } else {
        const file = await chooseWebFile();
        if (!file) return;
        filename = file.name;
        contents = await file.text();
      }
      const imported = normaliseImportedTrace(JSON.parse(contents), filename);
      setWorkspace(imported);
      setPassageId(imported.passages[0].id);
      setRunId(imported.runs[0].id);
      setIteration(Math.max(0, imported.runs[0].trace.length - 1));
      setView("studio");
      setToast(`Opened ${imported.name}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not open that trace");
    }
  }

  if (loadingError) return <div className="loading-screen error"><AlertCircle /><h1>Workspace could not be opened</h1><p>{loadingError}</p></div>;
  if (!workspace || !passage || !run || !frame) return <div className="loading-screen"><div className="loader-mark"><Sparkles /></div><h1>Opening evidence workspace</h1><p>Indexing optimiser decisions and system states…</p></div>;

  const passageRuns = workspace.runs.filter((item) => item.passage === passage.id);
  const representations = [...new Set(passageRuns.map((item) => item.representation))];
  return (
    <div className="app-shell">
      <AppHeader workspace={workspace} view={view} onView={setView} onImport={importTrace} />
      <div className="app-body">
        <RunSidebar workspace={workspace} passage={passage} run={run} onPassage={selectPassage} onRun={selectRun} />
        {view === "studio" && (
          <div className="studio-shell">
            <main className="studio-main scrollable">
              <div className="studio-toolbar">
                <div><span className="eyebrow">Active run</span><h1>{optimizerLabel(run.optimizer)} <span>on {passage.label}</span></h1></div>
                <div className="toolbar-actions">
                  <label className="compact-select">{representationLabel(run.representation)}<ChevronDown size={13} /><select value={run.representation} onChange={(event) => { const next = passageRuns.find((item) => item.optimizer === run.optimizer && item.representation === event.target.value); if (next) selectRun(next.id); }}>{representations.map((value) => <option key={value} value={value}>{representationLabel(value)}</option>)}</select></label>
                  <div className="canvas-switcher"><button className={canvasMode === "system" ? "active" : ""} onClick={() => setCanvasMode("system")} title="System view"><Gauge /></button><button className={canvasMode === "split" ? "active" : ""} onClick={() => setCanvasMode("split")} title="Split view"><Columns3 /></button><button className={canvasMode === "search" ? "active" : ""} onClick={() => setCanvasMode("search")} title="Search view"><Mountain /></button></div>
                  <button className="icon-button" title="Fit view"><Maximize2 /></button>
                </div>
              </div>
              <KpiStrip run={run} frame={frame} />
              {(canvasMode === "system" || canvasMode === "split") && <Panel title={isSurface ? "Objective landscape" : "System playback"} eyebrow={`Iteration ${iteration} · retained ${isSurface ? "point" : "programme"}`} className="viewport-panel" action={<EvidenceBadge frame={frame} />}>{isSurface ? <SurfaceViewport passage={passage} trace={run.trace} iteration={iteration} /> : <FlightViewport samples={samples} passage={passage} timeIndex={timeIndex} onTimeIndex={setTimeIndex} />}</Panel>}
              {(canvasMode === "search" || canvasMode === "split") && <SearchLens run={run} iteration={iteration} onIteration={setIteration} />}
              {!isSurface && <ControlTracks samples={samples} passage={passage} timeIndex={timeIndex} onTimeIndex={setTimeIndex} />}
            </main>
            <Inspector frame={frame} breakdown={breakdown} surface={passage.surface} />
            <IterationTimeline run={run} index={iteration} onIndex={setIteration} playing={playing} onPlaying={setPlaying} />
          </div>
        )}
        {view === "compare" && <CompareView runs={passageRuns} passage={passage} representation={run.representation} onRepresentation={(value) => { const next = passageRuns.find((item) => item.optimizer === run.optimizer && item.representation === value) ?? passageRuns.find((item) => item.representation === value); if (next) selectRun(next.id); }} onOpenRun={(id, index) => { selectRun(id, index); setView("studio"); }} />}
        {view === "branches" && branchAnalyses && <BranchLab analyses={branchAnalyses} workspace={workspace} onOpenOriginal={(id, index) => { selectRun(id, index); setView("studio"); }} />}
        {view === "evidence" && <EvidenceView workspace={workspace} onOpenRun={(id, index) => { selectRun(id, index); setView("studio"); }} />}
      </div>
      {toast && <div className="toast"><AlertCircle />{toast}</div>}
    </div>
  );
}

function AppHeader({ workspace, view, onView, onImport }: { workspace: WorkspaceData; view: MainView; onView: (view: MainView) => void; onImport: () => void }) {
  return <header className="app-header"><div className="brand"><span className="brand-mark"><Mountain /></span><div><strong>Optimiser</strong><span>Visual Editor</span></div><em>ALPHA</em></div><nav><button className={view === "studio" ? "active" : ""} onClick={() => onView("studio")}><Play />Studio</button><button className={view === "compare" ? "active" : ""} onClick={() => onView("compare")}><BarChart3 />Compare</button><button className={view === "branches" ? "active" : ""} onClick={() => onView("branches")}><GitBranch />Branches</button><button className={view === "evidence" ? "active" : ""} onClick={() => onView("evidence")}><ScanSearch />Evidence</button></nav><div className="workspace-title"><small>Workspace</small><strong>{workspace.name}</strong><ChevronDown /></div><div className="header-actions"><button title="Open trace" onClick={onImport}><FolderOpen /></button><button title="Export snapshot" onClick={() => window.print()}><Download /></button><button title="Settings"><Settings2 /></button><button title="Help"><CircleHelp /></button><button title="Menu"><Menu /></button></div></header>;
}

function KpiStrip({ run, frame }: { run: OptimizerRun; frame: OptimizerRun["trace"][number] }) {
  const reduction = 100 * (1 - frame.value_after / (run.trace[0]?.value_before || frame.value_after));
  return <div className="kpi-strip"><Kpi label="Objective" value={formatNumber(frame.value_after, 5)} delta={`${formatNumber(reduction, 1)}% reduced`} tone="accent" /><Kpi label="Native gradient" value={formatNumber(frame.native_gradient_norm)} delta="recorded norm" /><Kpi label="Step α" value={formatNumber(frame.alpha, 6)} delta={`${frame.line_search_trials.length} line-search trials`} /><Kpi label="Metric condition" value={formatNumber(frame.metric_after.condition_number)} delta={frame.metric_after.condition_number > 1e7 ? "extreme spectral spread" : "within observed range"} tone={frame.metric_after.condition_number > 1e7 ? "danger" : "success"} /></div>;
}

function Kpi({ label, value, delta, tone = "" }: { label: string; value: string; delta: string; tone?: string }) {
  return <div className={`kpi ${tone}`}><small>{label}</small><strong>{value}</strong><span>{delta}</span></div>;
}

function EvidenceBadge({ frame }: { frame: OptimizerRun["trace"][number] }) {
  const tone = !frame.adopted ? "danger" : frame.elected || frame.nominated ? "accent" : "";
  const text = !frame.adopted ? "Line search failure" : frame.elected ? "Candidate elected" : frame.refused ? "Candidate refused" : frame.nominated ? "Candidate nominated" : "Adopted movement";
  return <span className={`evidence-badge ${tone}`}><i />{text}</span>;
}

function SearchLens({ run, iteration, onIteration }: { run: OptimizerRun; iteration: number; onIteration: (value: number) => void }) {
  const objective = [run.trace[0]?.value_before ?? run.final_value, ...run.trace.map((item) => item.value_after)];
  const condition = run.trace.map((item) => item.metric_after.condition_number);
  const gradient = run.trace.map((item) => item.native_gradient_norm);
  return <div className="search-lens">
    <Panel title="Objective history" eyebrow="Search lens" action={<span className="panel-badge">log scale</span>}>
      <LineChart height={180} logScale activeIndex={iteration + 1} onSelect={(index) => onIteration(Math.max(0, index - 1))} series={[{ label: "Objective", values: objective, colour: "#ffb357" }]} />
    </Panel>
    <Panel title="Geometry and gradient" eyebrow="Search lens" action={<span className="panel-badge">log scale</span>}>
      <LineChart height={180} logScale activeIndex={iteration} onSelect={onIteration} series={[{ label: "Metric condition", values: condition, colour: "#ff6f83" }, { label: "Native gradient", values: gradient, colour: "#7bdff2", dashed: true }]} />
    </Panel>
  </div>;
}

function chooseWebFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,.ove,application/json";
    input.onchange = () => resolve(input.files?.[0] ?? null); input.click();
  });
}
