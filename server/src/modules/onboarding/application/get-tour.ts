import { OnboardingAttempt, OnboardingTour, type OnboardingTourResponse } from '../../../vendor/shared/contracts/onboarding-tour.js';
import type { TourRepositoryPort } from './ports.js';

export class GetTour {
  constructor(private readonly repository: TourRepositoryPort, private readonly revision: (repoId: string) => Promise<string | null>) {}
  async get(workspaceId: string, repoId: string): Promise<OnboardingTourResponse | null> {
    const row = await this.repository.get(workspaceId, repoId);
    if (!row) return null;
    const parsed = OnboardingTour.safeParse(row.tour?.json);
    const tour = parsed.success ? parsed.data : null;
    if (tour) {
      const current = await this.revision(repoId);
      tour.freshness = !current || !tour.source_revision ? 'unknown' : current === tour.source_revision ? 'current' : 'stale';
    }
    const stored = row.attempt as { status?: unknown } | null;
    const attempt = OnboardingAttempt.safeParse(stored ? { ...stored, retryable: stored.status === 'failed' || stored.status === 'cancelled' || stored.status === 'partial' } : null);
    return { tour, attempt: attempt.success ? attempt.data : null };
  }
}
