import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfigTab } from "./ConfigTab";

describe("ConfigTab", () => {
  it("renders persisted skill metadata without inventing a value", () => {
    render(<ConfigTab skill={{ id: "skill-1", name: "Rules", description: "Safe defaults", type: "security", source: "manual", body: "# Rules", enabled: true, version: 2, agent_count: 3, evidence_files: null }} />);

    expect(screen.getByText("v2 · 3 agents")).toBeInTheDocument();
    expect(screen.getAllByText("Enabled")).toHaveLength(2);
  });
});
