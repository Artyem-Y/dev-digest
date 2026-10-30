import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ useQuery: vi.fn(), useMutation: vi.fn(), useQueryClient: vi.fn(), get: vi.fn(), post: vi.fn(), invalidate: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.useQuery, useMutation: mocks.useMutation, useQueryClient: mocks.useQueryClient }));
vi.mock('../api', () => ({ api: { get: mocks.get, post: mocks.post } }));
import { useGenerateOnboardingTour, useOnboardingTour } from './onboarding-tour';
it('GET never generates and polls only pending attempts', async () => {
  useOnboardingTour('repo'); const options = mocks.useQuery.mock.calls[0]![0];
  await options.queryFn(); expect(mocks.get).toHaveBeenCalledWith('/repos/repo/onboarding-tour'); expect(mocks.post).not.toHaveBeenCalled();
  expect(options.refetchInterval({ state: { data: { attempt: { status: 'pending' } } } })).toBe(1000);
  expect(options.refetchInterval({ state: { data: { attempt: { status: 'failed' } } } })).toBe(false);
  mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidate }); useGenerateOnboardingTour('repo');
  const mutation = mocks.useMutation.mock.calls[0]![0]; await mutation.mutationFn(); expect(mocks.post).toHaveBeenCalledWith('/repos/repo/onboarding-tour');
});
