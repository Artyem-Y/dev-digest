import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";
import type { Skill } from "@devdigest/shared";

const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: [
    { id: "skill-1", name: "Boundary cases", description: "Failure paths", type: "rubric", source: "manual", body: "Check empty input.", enabled: true, version: 2 },
  ], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateSkill: () => ({ mutate: create, isPending: false }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useDeleteSkill: () => ({ mutate: remove, isPending: false }),
  useImportSkillPreview: () => ({ mutate: vi.fn(), isPending: false }),
  useImportSkill: () => ({ mutate: vi.fn(), isPending: false }),
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
    expect(screen.getAllByText("v2")).toHaveLength(2);
    expect(screen.getByText("Check empty input.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search skills…"), { target: { value: "missing" } });
    expect(screen.queryByText("Boundary cases")).not.toBeInTheDocument();
  });

  it("toggles a skill directly from its card", () => {
    renderLab();

    fireEvent.click(screen.getAllByRole("switch", { name: "Enable Boundary cases" })[0]!);

    expect(update).toHaveBeenCalledWith({
      id: "skill-1",
      name: "Boundary cases",
      description: "Failure paths",
      body: "Check empty input.",
      type: "rubric",
      enabled: false,
      expected_version: 2,
    });
  });

  it("lets Add Skill choose manual creation before opening its form", () => {
    renderLab();

    fireEvent.click(screen.getByRole("button", { name: "Add Skill" }));
    expect(screen.getByRole("button", { name: "Create manually" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import existing skill" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create manually" }));
    fireEvent.change(screen.getAllByLabelText("Skill name")[1]!, { target: { value: "Regression checks" } });
    fireEvent.change(screen.getAllByLabelText("Description")[1]!, { target: { value: "Contract regressions" } });
    fireEvent.change(screen.getAllByLabelText("Skill body (Markdown)")[1]!, { target: { value: "Check contracts." } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    expect(create).toHaveBeenCalledWith({
      name: "Regression checks",
      description: "Contract regressions",
      body: "Check contracts.",
      type: "custom",
    }, expect.any(Object));
  });
});
