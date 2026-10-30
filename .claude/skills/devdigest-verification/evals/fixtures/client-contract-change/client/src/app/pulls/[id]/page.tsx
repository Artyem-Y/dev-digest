export default async function PullPage({ params }: { params: { id: string } }) {
  const pull = await fetch(`/api/pulls/${params.id}`).then((response) => response.json());
  return <main><h1>{pull.title}</h1></main>;
}
