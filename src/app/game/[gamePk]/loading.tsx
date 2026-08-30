import { ThemeToggle } from "@/components/ThemeToggle";

export default function GameLoading() {
  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="eyebrow">Loading matchup…</div>
          <p className="lede">Starter mix and batting-order table.</p>
        </div>
        <ThemeToggle />
      </header>
      <div className="grid two">
        <div className="skel" />
        <div className="skel" />
      </div>
      <div className="skel" style={{ marginTop: 16, height: 220 }} />
    </main>
  );
}
