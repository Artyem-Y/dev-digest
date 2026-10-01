"use client";

/** Route-tree boundary for unexpected rendering errors below the root layout. */
export default function ErrorPage({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <p>The page could not be rendered. You can try again.</p>
      <button type="button" onClick={reset}>Try again</button>
    </main>
  );
}
