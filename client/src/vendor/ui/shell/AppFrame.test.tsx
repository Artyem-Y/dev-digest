import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppFrame } from "./AppFrame";
import type { ShellContext } from "./types";

vi.mock("./Sidebar", () => ({ Sidebar: () => <aside><a href="#eval">Eval Dashboard</a></aside> }));
vi.mock("./Topbar", () => ({ Topbar: () => <header>Header</header> }));

it("opens mobile navigation and closes it after choosing a destination", () => {
  render(<AppFrame ctx={{} as ShellContext}><div>Page</div></AppFrame>);
  const open = screen.getByLabelText("Open navigation");
  expect(open).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(open);
  expect(screen.getByLabelText("Close navigation")).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("link", { name: "Eval Dashboard" }));
  expect(screen.getByLabelText("Open navigation")).toHaveAttribute("aria-expanded", "false");
});
