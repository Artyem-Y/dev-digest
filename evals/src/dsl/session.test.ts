import { describe, expect, it } from "vitest";
import { assertSessionSucceeded } from "./session.js";

describe("workflow session status", () => {
  it("rejects an error even when an empty trace would satisfy a negative expectation", () => {
    expect(() => assertSessionSucceeded({ isError: true, text: "Not logged in" })).toThrow("Not logged in");
  });

  it("accepts a successful session", () => {
    expect(() => assertSessionSucceeded({ isError: false, text: "done" })).not.toThrow();
  });
});
