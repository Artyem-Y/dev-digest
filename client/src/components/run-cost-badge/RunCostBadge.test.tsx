import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunCostBadge, formatRunCostUsd } from "./RunCostBadge";

describe("RunCostBadge", () => {
  it.each([
    [0, "$0.00"],
    [0.06, "$0.06"],
    [0.014, "$0.014"],
    [0.0013, "$0.0013"],
    [0.00001, "<$0.0001"],
  ])("formats %s as %s", (costUsd, expected) => {
    expect(formatRunCostUsd(costUsd)).toBe(expected);
  });

  it("renders an em dash, never a fabricated zero, when cost is unavailable", () => {
    render(<RunCostBadge costUsd={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders tokens and cost in the timeline variant", () => {
    render(<RunCostBadge variant="timeline" costUsd={0.0013} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByText("9,500 tok · $0.0013")).toBeInTheDocument();
  });
});
