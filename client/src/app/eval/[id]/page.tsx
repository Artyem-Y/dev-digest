import { EvalDashboard } from "@/components/evals/EvalDashboard";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EvalDashboard agentId={id} />;
}
