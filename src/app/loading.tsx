export default function Loading() {
  return (
    <main className="wrap">
      <div className="eyebrow">Loading today&apos;s slate…</div>
      <p className="lede">Pulling today&apos;s MLB schedule. Pitch-mix files follow if they are not cached.</p>
      <div className="grid games">
        <div className="skel" />
        <div className="skel" />
        <div className="skel" />
        <div className="skel" />
      </div>
    </main>
  );
}
