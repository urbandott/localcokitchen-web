"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Error</p>
        <h1>Something went wrong</h1>
        <p className="lede">{error.digest ? `Reference: ${error.digest}` : "Please try again."}</p>
        <button className="primary-action" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
