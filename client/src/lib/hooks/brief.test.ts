import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}));
vi.mock("../api", () => ({ api: { get: mocks.get, post: mocks.post } }));

import { useBrief, useGenerateBrief } from "./brief";

describe("PR Brief hooks", () => {
  it("fetches only while the Overview tab is active and never posts as a query side effect", async () => {
    useBrief("pull-1", true);
    const active = mocks.useQuery.mock.calls[0]![0];

    expect(active.queryKey).toEqual(["pr-brief", "pull-1"]);
    expect(active.enabled).toBe(true);
    await active.queryFn();
    expect(mocks.get).toHaveBeenCalledWith("/pulls/pull-1/brief");
    expect(mocks.post).not.toHaveBeenCalled();

    useBrief("pull-1", false);
    expect(mocks.useQuery.mock.calls[1]![0].enabled).toBe(false);
  });

  it("posts only from the explicit mutation and invalidates the cache after success", async () => {
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
    useGenerateBrief("pull-1");
    const options = mocks.useMutation.mock.calls[0]![0];

    await options.mutationFn();
    expect(mocks.post).toHaveBeenCalledWith("/pulls/pull-1/brief");
    options.onSuccess();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["pr-brief", "pull-1"] });
  });
});
