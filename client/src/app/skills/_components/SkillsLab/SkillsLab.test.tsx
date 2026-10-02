import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";
import type { Skill } from "@devdigest/shared";

const create = vi.fn();
const update = vi.fn();

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: [
    { id: "skill-1", name: "Boundary cases", description: "Failure paths", type: "rubric", source: "manual", body: "Check empty input.", enabled: true, version: 2 },
  ], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateSkill: () => ({ mutate: create, isPending: false }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
}));

import { SkillsLab } from "./SkillsLab";

afterEach(() => {
  cleanup();
  create.mockReset();
  update.mockReset();
});

function renderLab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillsLab />
    </NextIntlClientProvider>,
  );
}

describe("SkillsLab", () => {
  it("filters manual skills and previews their versioned text safely", () => {
    renderLab();

    expect(screen.getAllByText("Boundary cases")).toHaveLength(2);
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Check empty input.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search skills…"), { target: { value: "missing" } });
    expect(screen.queryByText("Boundary cases")).not.toBeInTheDocument();
  });

  it("creates only a manual text skill", () => {
    renderLab();

    fireEvent.click(screen.getByRole("button", { name: "Add Skill" }));
    fireEvent.change(screen.getByLabelText("Skill name"), { target: { value: "Regression checks" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Contract regressions" } });
    fireEvent.change(screen.getByLabelText("Skill body (Markdown)"), { target: { value: "Check contracts." } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    expect(create).toHaveBeenCalledWith({
      name: "Regression checks",
      description: "Contract regressions",
      body: "Check contracts.",
      type: "custom",
    }, expect.any(Object));
  });
});
