/** Round stats (pure, unit-tested). */

/**
 * Average solve time in ms: each entry is the time from a board appearing to its correct tap (feedback and teaching
 * time are excluded because the next board's clock starts when it is shown). null when nothing was solved.
 */
export function avgSolve(times: number[]): number | null {
  const ok = times.filter(t => Number.isFinite(t) && t >= 0);
  return ok.length ? Math.round(ok.reduce((s, x) => s + x, 0) / ok.length) : null;
}
/** "1.3s"; "—" when there is no average. */
export const secLabel = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
