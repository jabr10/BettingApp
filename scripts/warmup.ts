import { loadSlate } from "../src/lib/slate";
import { todayEt } from "../src/lib/dates";

async function main() {
  const date = todayEt();
  console.log(`Warming slate + Savant caches for ${date} (America/New_York)…`);
  const slate = await loadSlate(date);
  console.log(`Games: ${slate.games.length}`);
  console.log(`Savant as of: ${slate.cache.savantAsOf}`);
  console.log(`Warnings: ${slate.warnings.length}`);
  for (const w of slate.warnings) console.log(` - ${w.source}: ${w.message}`);
  for (const g of slate.games) {
    console.log(
      `${g.away.abbreviation} @ ${g.home.abbreviation} ${g.gameTimeEt} chips=${g.chips.length} lu=${g.lineupState}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
