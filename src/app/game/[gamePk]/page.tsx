import { Suspense } from "react";
import { GameView } from "@/components/GameView";
import { todayEt } from "@/lib/dates";
import { loadGame, loadSlateShell } from "@/lib/slate";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function GamePage({
  params,
}: {
  params: Promise<{ gamePk: string }>;
}) {
  const { gamePk } = await params;
  const pk = Number(gamePk);
  if (!Number.isFinite(pk)) notFound();
  const shell = await loadSlateShell();
  const shellGame = shell.games.find((g) => g.gamePk === pk);
  if (!shellGame) notFound();

  return (
    <Suspense fallback={<GameView game={shellGame} savantPending />}>
      <EnrichedGame pk={pk} date={shell.dateEt} />
    </Suspense>
  );
}

async function EnrichedGame({ pk, date }: { pk: number; date: string }) {
  try {
    const game = await loadGame(pk, date);
    if (!game) notFound();
    return <GameView game={game} />;
  } catch (err) {
    const shell = await loadSlateShell(date);
    const game = shell.games.find((g) => g.gamePk === pk);
    if (!game) notFound();
    const message = err instanceof Error ? err.message : String(err);
    return (
      <GameView
        game={{
          ...game,
          warnings: [
            ...game.warnings,
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
