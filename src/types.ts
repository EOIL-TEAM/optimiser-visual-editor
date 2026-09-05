export type OptimizerName = "sorf" | "steepest_descent" | "bfgs" | string;
export type RepresentationName = "native" | "fixed_linear_shear" | "fixed_nonlinear_cubic" | string;

export interface MetricSummary {
  minimum_eigenvalue: number;
  maximum_eigenvalue: number;
  condition_number: number;
  determinant_sign: number;
  log_abs_determinant: number;
}

export interface TrialEvaluation {
  value: number;
  native_gradient_norm: number;
  native_norm: number;
}

export interface TraceFrame {
  iteration: number;
  value_before: number;
  value_after: number;
  adopted: boolean;
  alpha: number | null;
  line_search_trials: TrialEvaluation[];
  operative_gradient_norm: number;
  native_gradient_norm: number;
  direction_norm: number;
  operative_movement_norm: number;
  native_movement_norm: number;
  standing: string;
  nominated: boolean;
  ordeal_fired: boolean;
  elected: boolean;
  refused: boolean;
  bfgs_update_applied?: boolean;
  scores?: { parent: number; child: number } | null;
  s?: number[] | null;
  p?: number[] | null;
  r?: number[] | null;
  q?: number | null;
  z_after: number[];
  native_after: number[];
  metric_before?: MetricSummary;
  metric_after: MetricSummary;
}

export interface OptimizerRun {
  id: string;
  passage: string;
  optimizer: OptimizerName;
  representation: RepresentationName;
  trace: TraceFrame[];
  stop_reason: string;
  objective_evaluations: number;
  final_value: number;
}

export interface PassageDefinition {
  id: string;
  label: string;
  purpose: string;
  horizon: number;
  dt: number;
  initial_state: number[];
  target_state: number[];
}

export interface WorkspaceData {
  schema_version: string;
  name: string;
  created_at: string;
  source: string;
  passages: PassageDefinition[];
  runs: OptimizerRun[];
}

export interface FlightState {
  x: number;
  z: number;
  pitch: number;
  vx: number;
  vz: number;
  pitchRate: number;
}

export interface FlightSample extends FlightState {
  time: number;
  collective: number;
  torque: number;
  leftForce: number;
  rightForce: number;
}

export interface ObjectiveBreakdown {
  tracking: number;
  terminal: number;
  control: number;
  smoothness: number;
  actuator: number;
  total: number;
}

export type MainView = "studio" | "compare" | "evidence";
