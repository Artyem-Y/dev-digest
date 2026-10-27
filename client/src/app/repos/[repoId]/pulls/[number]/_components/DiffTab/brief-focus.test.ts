import { describe, expect, it, vi } from "vitest";
import { BRIEF_FOCUS_DURATION_MS, scheduleBriefFocusClear } from "./brief-focus";

describe("scheduleBriefFocusClear", () => {
  it("clears a temporary Brief focus after the marker duration", () => {
    vi.useFakeTimers();
    const clear = vi.fn();
    const dispose = scheduleBriefFocusClear(clear);

    vi.advanceTimersByTime(BRIEF_FOCUS_DURATION_MS - 1);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledOnce();
    dispose();
    vi.useRealTimers();
  });
});
