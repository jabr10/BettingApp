export default function Loading() {
  return (
    <main className="wrap">
      <div className="eyebrow">Loading today&apos;s slate…</div>
      <p className="lede">
        First load after a cache miss pulls Savant leaderboards (polite rate). This can take a bit.
      </p>
      <div className="grid games">
        <div className="skel" />
        <div className="skel" />
        <div className="skel" />
        <div className="skel" />
      </div>
    </main>
  );
}
