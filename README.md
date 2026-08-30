# Matchup Research

A first-version **MLB betting-research matchup tool**. It is **not a sportsbook**. It does not invent odds, implied probabilities, or place bets.

Each lineup bat is scored against the **starter’s pitch mix** (usage-weighted vs-pitch-type expected stats). It does **not** use batter-vs-this-pitcher head-to-head slash lines.

## How to run

Requires Node 20+.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No login.

Useful extras:

```bash
npm test              # scoring / chip / shrink unit tests
npm run warmup        # pull + cache Savant/Stats so the first page load is fast
npm run build && npm start
```

The home screen is **today’s slate** in `America/New_York` (game time, park, both starters + hand + top pitches, lineup state, up to 3 chips). Tap a game for the starter mix card and the full batting-order table.

First request after a cache miss talks to Baseball Savant with a polite delay between CSV downloads. That can take 30–60 seconds. After that, leaderboards are cached on disk in `.cache/` for ~20 hours; the day’s slate is cached ~10 minutes.

## Data sources

Joined on **MLB `player_id`**.

| Need | Source | Cache |
| --- | --- | --- |
| Slate, parks, probable pitchers, official lineups | [MLB Stats API](https://statsapi.mlb.com/api/v1/schedule?sportId=1) `hydrate=probablePitcher,lineups,venue,team` | ~10–30 min |
| Hands / bat side | `GET /api/v1/people?personIds=` | ~20 h |
| Projected lineups | Same schedule hydrate over the previous 60 days; last 10 games vs that starter hand (mode per batting slot). Banner: **Projected lineup, not official.** | ~30 min |
| Pitcher mix, 2026 | Savant [pitch-arsenals](https://baseballsavant.mlb.com/leaderboard/pitch-arsenals) `year=2026&min=1&type=n_&csv=true`, filled with [pitch-arsenal-stats](https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats) `type=pitcher&year=2026&min=1&csv=true` | ~20 h |
| Pitcher vs-type expected stats, 2026 | `pitch-arsenal-stats` pitcher CSV (xwOBA / xBA / xSLG / Whiff % / Hard Hit % / RV/100 / PA / pitches) | ~20 h |
| Batter vs-type, **2025+2026 combined** (PA-weighted) | `pitch-arsenal-stats` batter CSV, `year=2025` and `year=2026`, `min=1` | ~20 h |
| Batter vs-hand means + league same-hand baseline | Grouped Statcast Search CSV (`group_by=name`, `pitcher_throws=L\|R`, `hfSea=2025\|2026`, `hfGT=R`, `min_abs=1`) — used because the arsenal-stats leaderboard is **not** split by pitcher hand | ~20 h |
| Batter barrel % by pitch type | Grouped Statcast Search CSV per `hfPT` (not pitch-level `type=details`). The arsenal-stats leaderboard does **not** export barrel % | ~20 h |

Savant CSV query params (confirmed against the live leaderboards):

- `year` / `hfSea` — season
- `type=pitcher` or `type=batter` on arsenal-stats; `type=n_` on pitch-arsenals (usage %)
- `min=1` — minimum PA/pitches
- `csv=true` — CSV export
- Statcast Search: `group_by=name`, `player_type=batter`, `pitcher_throws`, `hfPT`, `hfGT=R|`, `hfSea=2025|2026|`

Pitch-level Statcast Search (`type=details`) is **not** used.

Failed fetches surface as empty/error copy. **No mock or invented rates.** A dash means “not on the export,” not zero.

Pitcher barrel % is not on `pitch-arsenal-stats`; the mix card shows `—` for that column and says so.

## Scoring (exact)

Pitch types: `FF, SI, FC, SL, ST, SV, CU, KC, CH, FS`. Any type under **8% usage**, or any non-core type (e.g. `KN`), rolls into **Other**.

Platoon: batter `batSide` vs pitcher `p_throws`. Switch-hitters stand opposite the pitcher.

### Shrink

Each batter vs-type rate is shrunk toward **that batter’s vs-that-hand mean** (2025–2026 grouped search):

```
shrunk_t = (PA_t * rate_t + PA_prior * vs_hand_mean) / (PA_t + PA_prior)
```

Priors:

| Rate | `PA_prior` |
| --- | --- |
| xwOBA | 80 |
| xBA | 80 (same expected-stat family as xwOBA; not listed separately in the product spec) |
| xSLG | 80 (same) |
| Whiff % | 60 |
| Barrel % | 100 |

Hard-hit % and RV/100 are shown on the pitcher mix card from Savant; they are not ranking inputs.

### Projection

```
proj = sum_t (usage_t × shrunk_batter_t)
```

over kept types plus the Other bucket (Other = PA-weighted combination of the rolled-up types).

### Edges and dampener

```
raw_edge = proj − league_same_hand_baseline
dampened  = raw_edge × 0.5
```

The **0.5** is a flat **pitcher-mix quality dampener**. It is labeled in the UI. It is **not** fitted to betting results.

### Units (Savant scales)

| Metric | How Savant stores it | Chip / display unit |
| --- | --- | --- |
| xwOBA | ~.250–.450 | **Points = thousandths**. `+20 xwOBA` = `+0.020` |
| xSLG | ~.350–.550 | **Points = thousandths**. `+40 xSLG` = `+0.040` |
| Whiff % | percent of swings (e.g. 24.5) | **Percentage points**. `+4 whiff` = `+4.0` |
| Barrel % | barrels / batted balls (`barrels_per_bbe_percent`) | **Percentage points**. `+2 barrel` = `+2.0` |
| RV/100 | run value per 100 pitches | Shown on the mix card only |

Displayed Hits / K / HR columns are the **dampened** edges in those units.

### Confidence and rank

- Comparison PA = sum of the batter’s 2025–2026 PA against the pitch types in the starter mix (including types rolled into Other).
- If comparison PA **&lt; 25**, label **Low confidence**.
- A low-confidence row **cannot outrank** a large-sample row in the slate chip sort.
- Rank/score on **expected stats only**. No BA/SLG. No last-7-day BA.

### Chips (max 3 per game)

Applied to **dampened** edges:

- **Hits** if xwOBA edge ≥ **+20** points
- **HR** if barrel edge ≥ **+2** pp **or** xSLG edge ≥ **+40** points
- **K** if whiff edge ≥ **+4** pp
- **Fade** if xwOBA edge ≤ **−20** points

Inside a game, **every batting-order row** is shown (not only chips), each with Hits / K / HR edges, confidence, and a one-line **why** that cites pitch types + PA (e.g. `Crushes ST/SL; Luzardo is 41% breaking balls; 62 PA vs ST`).

## What v1 does not claim

- Not a sportsbook. No moneyline, run line, or full-game total.
- No lock / guaranteed / +EV copy.
- No H2H slash lines on the default view.
- No last-7-day BA. No “he’s due.”
- We do **not** ingest close and we do **not** claim CLV or that we beat the market.
- v2-only (not built): bat tracking, location zones, park/weather/ABS.

## Deploy

This is a Next.js server app (Savant is never called from the browser). A preview URL needs a Node host with outbound HTTPS to `statsapi.mlb.com` and `baseballsavant.mlb.com` (Vercel, Fly, or similar). This repo does not include host credentials, so no public preview is published from the agent environment unless those secrets are provided.
