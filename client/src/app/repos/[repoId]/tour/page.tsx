'use client';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useActiveRepo } from '@/lib/repo-context';
import { OnboardingTour } from './_components/OnboardingTour';
export default function TourPage() {
  const params = useParams<{ repoId: string }>();
  const { activeRepo } = useActiveRepo();
  return <AppShell crumb={[...(activeRepo ? [{ label: activeRepo.full_name, href: `/repos/${params.repoId}/pulls` }] : []), { label: 'Onboarding Tour' }]}><OnboardingTour repoId={params.repoId} /></AppShell>;
}
