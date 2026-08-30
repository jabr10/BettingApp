import { ThemeToggle } from "@/components/ThemeToggle";

export default function Loading() {
  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="eyebrow">Loading today&apos;s slate…</div>
          <p className="lede">
            Pulling today&apos;s MLB schedule. Pitch-mix files follow if they are not cached.
          </p>
        </div>
        <ThemeToggle />
      </header>
      <div className="grid games">
        <div className="skel" />
        <div className="skel" />
        <div className="skel" />
        <div className="skel" />
      </div>
    </main>
  );
}
