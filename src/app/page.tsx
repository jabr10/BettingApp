import { Suspense } from "react";
import { HomeView } from "@/components/HomeView";
import { loadSlate, loadSlateShell } from "@/lib/slate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function HomePage() {
  const shell = await loadSlateShell();
  if (!shell.games.length) {
    return <HomeView slate={shell} />;
  }
  return (
    <Suspense fallback={<HomeView slate={shell} savantPending />}>
      <EnrichedHome date={shell.dateEt} />
    </Suspense>
  );
}

async function EnrichedHome({ date }: { date: string }) {
  try {
    const slate = await loadSlate(date);
    return <HomeView slate={slate} />;
  } catch (err) {
    const shell = await loadSlateShell(date);
    const message = err instanceof Error ? err.message : String(err);
    return (
      <HomeView
        slate={{
          ...shell,
          warnings: [
            ...shell.warnings,
            {
              source: "savant",
              message: `Savant leaderboards failed: ${message}. No matchup numbers were invented.`,
            },
          ],
        }}
      />
    );
  }
}
