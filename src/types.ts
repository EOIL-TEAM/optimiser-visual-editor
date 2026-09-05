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

export interface SystemConsequence {
  terminal_position_error: number;
  maximum_position_error: number;
  terminal_attitude_error: number;
  control_energy: number;
  minimum_rotor_force: number;
  maximum_rotor_force: number;
  constraint_violation_count: number;
  maximum_constraint_violation: number;
  trajectory: number[][];
}

export interface BranchDirection {
  operative_norm: number;
  native_norm: number;
  directional_derivative: number;
  cosine_to_negative_gradient: number;
  gradient_alignment_minimum_eigenvector: number;
  gradient_alignment_maximum_eigenvector: number;
  native_components: number[];
}

export interface CounterfactualBranch {
  id: string;
  label: string;
  family: "sorf" | "bfgs";
  interpolation: number;
  start_value: number;
  final_value: number;
  stop_reason: string;
  iterations: number;
  adoptions: number;
  objective_evaluations: number;
  objective_efficiency: number;
  direction: BranchDirection;
  metric: MetricSummary & { eigenvalue_quantiles: number[] };
  immediate: {
    adopted: boolean;
    alpha: number | null;
    value: number;
    reduction: number;
    line_search_values: number[];
    diagnostic_ray_values: number[];
    first_improving_exponent: number | null;
    system: SystemConsequence;
  };
  multi: {
    values: number[];
    cumulative_evaluations: number[];
    conditions: number[];
    native_gradient_norms: number[];
    final_system: SystemConsequence;
  };
}

export interface BranchAnalysis {
  id: string;
  run_id: string;
  passage: string;
  representation: string;
  election_iteration: number;
  outcome: "failed_next_extension" | "survived_next_extension";
  checkpoint: {
    archive_key: string;
    value: number;
    native_gradient_norm: number;
    parent_metric: MetricSummary & { eigenvalue_quantiles: number[] };
    candidate_metric: MetricSummary & { eigenvalue_quantiles: number[] };
    election_scores: { parent: number; child: number };
    s_norm: number;
    p_norm: number;
    r_norm: number;
    q: number;
  };
  reproduction: {
    compared_iterations: number;
    maximum_value_residual: number;
    passed: boolean;
  };
  branches: CounterfactualBranch[];
}

export interface BranchAnalysisWorkspace {
  schema_version: string;
  created_at: string;
  continuation_iterations: number;
  engine: string;
  analyses: BranchAnalysis[];
}

export type MainView = "studio" | "compare" | "branches" | "evidence";
