export function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const magnitude = Math.abs(value);
  if ((magnitude > 0 && magnitude < 0.001) || magnitude >= 100_000) {
    return value.toExponential(2);
  }
  return value.toLocaleString("en-GB", { maximumFractionDigits: digits });
}

export function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function optimizerLabel(value: string): string {
  if (value === "sorf") return "SORF";
  if (value === "transient_sorf") return "Transient SORF (experimental)";
  if (value === "projective_sorf_ls_v0") return "Projective SORF-LS v0";
  if (value === "projective_sorf_ls_v1") return "Projective SORF-LS v1";
  if (value === "bfgs") return "BFGS";
  if (value === "lbfgs_m10") return "L-BFGS (m=10)";
  if (value === "structural_gauss_newton") return "Structural Gauss–Newton";
  if (value === "exact_newton_trust_region") return "Exact Newton (trust region)";
  if (value === "certified_structural_gauss_newton") return "Certified structural GN";
  if (value === "certified_warm_start_gauss_newton") return "Certified warm-start GN";
  if (value === "steepest_descent") return "Steepest descent";
  return humanize(value);
}

export function representationLabel(value: string): string {
  if (value === "native") return "Native";
  if (value === "fixed_linear_shear") return "Linear shear";
  if (value === "fixed_nonlinear_cubic") return "Nonlinear cubic";
  return humanize(value);
}

export function compactVector(vector?: number[] | null, limit = 4): string {
  if (!vector) return "Not recorded";
  const values = vector.slice(0, limit).map((value) => formatNumber(value, 4));
  return `[${values.join(", ")}${vector.length > limit ? `, … ${vector.length - limit} more` : ""}]`;
}
