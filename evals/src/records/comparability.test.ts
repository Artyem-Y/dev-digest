import { describe, expect, it } from "vitest";
import { assertComparable } from "./comparability.js";

describe("repeat series comparability", () => {
  it("rejects missing or changed evaluation identity", () => {
    expect(() => assertComparable({}, {})).toThrow();
    expect(() => assertComparable({ evalIdentity: "a" }, { evalIdentity: "b" })).toThrow();
    expect(() => assertComparable({ evalIdentity: "a" }, { evalIdentity: "a" })).not.toThrow();
  });
});
