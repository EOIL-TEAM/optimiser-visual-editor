import type { FlightSample, ObjectiveBreakdown, PassageDefinition } from "../types";

const MASS = 1;
const INERTIA = 0.025;
const ARM = 0.2;
const GRAVITY = 9.81;
const LINEAR_DRAG = 0.08;
const ANGULAR_DRAG = 0.04;
const ROTOR_MAX = 9.81;

const RUNNING_WEIGHTS = [0.08, 0.12, 0.04, 0.015, 0.02, 0.008];
const TERMINAL_WEIGHTS = [24, 32, 8, 5, 6, 1.5];
const CONTROL_WEIGHTS = [0.008, 0.12];
const SMOOTHNESS_WEIGHTS = [0.012, 0.18];

export function simulatePassage(native: number[], passage: PassageDefinition): FlightSample[] {
  const state = [...passage.initial_state];
  const samples: FlightSample[] = [];
  const horizon = Math.min(passage.horizon, Math.floor(native.length / 2));

  for (let k = 0; k <= horizon; k += 1) {
    const controlIndex = Math.min(k, Math.max(0, horizon - 1)) * 2;
    const collective = native[controlIndex] ?? 0;
    const torque = native[controlIndex + 1] ?? 0;
    const total = GRAVITY + collective;
    const leftForce = 0.5 * (total - torque / ARM);
    const rightForce = 0.5 * (total + torque / ARM);
    samples.push({
      time: k * passage.dt,
      x: state[0], z: state[1], pitch: state[2],
      vx: state[3], vz: state[4], pitchRate: state[5],
      collective, torque, leftForce, rightForce,
    });
    if (k === horizon) break;

    const [x, z, pitch, vx, vz, pitchRate] = state;
    const derivatives = [
      vx,
      vz,
      pitchRate,
      -(total / MASS) * Math.sin(pitch) - LINEAR_DRAG * vx,
      (total / MASS) * Math.cos(pitch) - GRAVITY - LINEAR_DRAG * vz,
      torque / INERTIA - ANGULAR_DRAG * pitchRate,
    ];
    for (let i = 0; i < state.length; i += 1) state[i] += passage.dt * derivatives[i];
    void x; void z;
  }
  return samples;
}

export function objectiveBreakdown(
  native: number[],
  passage: PassageDefinition,
  samples: FlightSample[],
): ObjectiveBreakdown {
  let tracking = 0;
  let control = 0;
  let smoothness = 0;
  let actuator = 0;
  const controls = Array.from({ length: passage.horizon }, (_, k) => [native[2 * k] ?? 0, native[2 * k + 1] ?? 0]);

  for (let k = 0; k < passage.horizon; k += 1) {
    const sample = samples[k];
    const state = [sample.x, sample.z, sample.pitch, sample.vx, sample.vz, sample.pitchRate];
    for (let i = 0; i < 6; i += 1) {
      const error = state[i] - passage.target_state[i];
      tracking += 0.5 * passage.dt * RUNNING_WEIGHTS[i] * error * error;
    }
    control += 0.5 * passage.dt * (
      CONTROL_WEIGHTS[0] * controls[k][0] ** 2 + CONTROL_WEIGHTS[1] * controls[k][1] ** 2
    );
    if (k > 0) {
      smoothness += 0.5 * (
        SMOOTHNESS_WEIGHTS[0] * (controls[k][0] - controls[k - 1][0]) ** 2 +
        SMOOTHNESS_WEIGHTS[1] * (controls[k][1] - controls[k - 1][1]) ** 2
      );
    }
    for (const force of [sample.leftForce, sample.rightForce]) {
      const residual = force < 0 ? force : force > ROTOR_MAX ? force - ROTOR_MAX : 0;
      actuator += 0.5 * 12 * residual * residual;
    }
  }

  const final = samples.at(-1)!;
  const terminalState = [final.x, final.z, final.pitch, final.vx, final.vz, final.pitchRate];
  let terminal = 0;
  for (let i = 0; i < 6; i += 1) {
    const error = terminalState[i] - passage.target_state[i];
    terminal += 0.5 * TERMINAL_WEIGHTS[i] * error * error;
  }
  return { tracking, terminal, control, smoothness, actuator, total: tracking + terminal + control + smoothness + actuator };
}
