"use client";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="eyebrow">Matchup research · not a sportsbook</div>
          <h1>Today&apos;s slate</h1>
        </div>
      </header>
      <div className="card empty error">
        Could not finish this page: {error.message}. No matchup numbers were invented.
      </div>
    </main>
  );
}
