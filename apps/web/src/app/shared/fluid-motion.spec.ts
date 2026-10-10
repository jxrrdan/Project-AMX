import { isSettled, project, releaseVelocity, rubberband, rubberbandClamp, stepSpring } from './fluid-motion';

describe('fluid-motion', () => {
  it('projects momentum with Apple’s exponential-decay form', () => {
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(-1000)).toBeCloseTo(-499, 0);
    expect(project(0)).toBe(0);
  });

  it('rubber-bands: resistance grows with distance and never exceeds the dimension', () => {
    expect(rubberband(0, 300)).toBe(0);
    const near = rubberband(20, 300);
    const far = rubberband(200, 300);
    expect(near).toBeLessThan(20);
    expect(far).toBeLessThan(200);
    expect(far / 200).toBeLessThan(near / 20); // more resistance the further you pull
    expect(rubberband(5000, 300)).toBeLessThan(300);
    expect(rubberband(-50, 300)).toBeLessThan(0);
  });

  it('leaves in-bounds values alone and resists out-of-bounds ones', () => {
    expect(rubberbandClamp(50, 0, 100, 300)).toBe(50);
    expect(rubberbandClamp(130, 0, 100, 300)).toBeGreaterThan(100);
    expect(rubberbandClamp(130, 0, 100, 300)).toBeLessThan(130);
    expect(rubberbandClamp(-30, 0, 100, 300)).toBeLessThan(0);
  });

  function simulate(dampingRatio: number, velocity = 0) {
    let state = { position: 0, velocity };
    let peak = 0;
    for (let i = 0; i < 600 && !isSettled(state, 100); i++) {
      state = stepSpring(state, 100, 1 / 60, dampingRatio, 0.35);
      peak = Math.max(peak, state.position);
    }
    return { state, peak };
  }

  it('a critically damped spring settles on target without overshoot', () => {
    const { state, peak } = simulate(1);
    expect(isSettled(state, 100)).toBe(true);
    expect(peak).toBeLessThanOrEqual(100.5);
  });

  it('an under-damped spring overshoots, then settles', () => {
    const { state, peak } = simulate(0.6);
    expect(peak).toBeGreaterThan(105);
    expect(isSettled(state, 100)).toBe(true);
  });

  it('carries release velocity through (velocity hand-off): a fast start arrives sooner', () => {
    const frames = (v: number) => {
      let s = { position: 0, velocity: v };
      let n = 0;
      while (!isSettled(s, 100) && n < 600) {
        s = stepSpring(s, 100, 1 / 60, 1, 0.35);
        n++;
      }
      return n;
    };
    expect(frames(1500)).toBeLessThan(frames(0));
  });

  it('is stable regardless of frame size', () => {
    const coarse = stepSpring({ position: 0, velocity: 0 }, 100, 0.1);
    expect(Number.isFinite(coarse.position)).toBe(true);
    expect(coarse.position).toBeGreaterThan(0);
  });

  it('computes release velocity from recent samples and ignores a paused pointer', () => {
    const now = performance.now();
    const moving = [
      { x: 0, y: 0, t: now - 80 },
      { x: 80, y: 0, t: now - 40 },
      { x: 160, y: 0, t: now - 1 },
    ];
    expect(releaseVelocity(moving).vx).toBeGreaterThan(1500);
    const paused = [
      { x: 0, y: 0, t: now - 600 },
      { x: 300, y: 0, t: now - 500 },
    ];
    expect(releaseVelocity(paused)).toEqual({ vx: 0, vy: 0 });
    expect(releaseVelocity([])).toEqual({ vx: 0, vy: 0 });
  });
});
