/** Keep Brief-driven file expansion and line emphasis deliberately temporary. */
export const BRIEF_FOCUS_DURATION_MS = 3_000;

export function scheduleBriefFocusClear(onClear: () => void) {
  const timer = window.setTimeout(onClear, BRIEF_FOCUS_DURATION_MS);
  return () => window.clearTimeout(timer);
}
