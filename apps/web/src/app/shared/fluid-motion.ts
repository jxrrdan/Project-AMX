/**
 * Pure motion maths for fluid, interruptible gestures (see apple-design: momentum projection,
 * rubber-banding, velocity-aware springs). No DOM here, so it is unit-tested.
 */

/** Apple's exponential-decay projection: where a flick at `velocity` (px/s) would coast to rest. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further over, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  const sign = overshoot < 0 ? -1 : 1;
  const x = Math.abs(overshoot);
  return (sign * (x * dimension * constant)) / (dimension + constant * x);
}

/** Clamp `value` into [min, max], applying rubber-band resistance to any overshoot. */
export function rubberbandClamp(value: number, min: number, max: number, dimension: number): number {
  if (value < min) return min + rubberband(value - min, dimension);
  if (value > max) return max + rubberband(value - max, dimension);
  return value;
}

export interface SpringState {
  position: number;
  velocity: number;
}

/**
 * Advance a damped spring by `dt` seconds. Parameterised the way designers think (Apple's model):
 * `dampingRatio` 1 = critically damped (no overshoot), <1 bounces; `response` is the time in seconds
 * the spring takes to reach its target, not a fixed duration. Semi-implicit Euler with sub-steps keeps
 * it stable at any frame rate, and the incoming `velocity` is carried through (velocity hand-off).
 */
export function stepSpring(state: SpringState, target: number, dt: number, dampingRatio = 1, response = 0.35): SpringState {
  const omega = (2 * Math.PI) / response;
  const stiffness = omega * omega;
  const damping = 2 * dampingRatio * omega;
  let { position, velocity } = state;
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const accel = -stiffness * (position - target) - damping * velocity;
    velocity += accel * h;
    position += velocity * h;
  }
  return { position, velocity };
}

export function isSettled(state: SpringState, target: number, epsilon = 0.4): boolean {
  return Math.abs(state.position - target) < epsilon && Math.abs(state.velocity) < epsilon * 4;
}

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

/** Release velocity (px/s) from the last ~100ms of pointer samples; zero if the pointer paused. */
export function releaseVelocity(samples: PointerSample[], windowMs = 100): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const last = samples[samples.length - 1];
  const recent = samples.filter((s) => last.t - s.t <= windowMs);
  const first = recent[0];
  const dt = (last.t - first.t) / 1000;
  // A finger that stopped before lifting has no momentum, even if it moved fast earlier.
  if (dt <= 0 || performance_now_gap(last) > 80) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

// Hook point so tests can reason about the "paused before release" rule without a real clock.
function performance_now_gap(last: PointerSample): number {
  return (typeof performance !== 'undefined' ? performance.now() : last.t) - last.t;
}
