const fetchFn: typeof fetch = (globalThis as any).fetch ?? (await import("node-fetch")).default as any;

type OddsQuote = {
  book: string;
  market: "moneyline" | "spread" | "total";
  team?: "home" | "away" | "over" | "under";
  price?: number | null;          // American odds (e.g., -110, +145)
  spread?: number | null;         // for spread markets
  total?: number | null;          // for totals
  updated: string;
};

export function americanToImplied(odds: number | null | undefined) {
  if (odds === null || odds === undefined || odds === 0) return null;
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

export async function getNflOddsToday(): Promise<Record<string, { quotes: OddsQuote[]; best: Record<string, OddsQuote | null> }>> {
  // 1) Get NFL scoreboard (events today / upcoming)
  const sb = await fetchFn("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard").then(r => r.json());

  const results: Record<string, { quotes: OddsQuote[]; best: Record<string, OddsQuote | null> }> = {};

  for (const ev of sb?.events ?? []) {
    const eventId = ev.id;
    const comp = ev.competitions?.[0];
    if (!eventId || !comp?.id) continue;
    const compId = comp.id;

    // 2) Fetch odds for this competition
    const oddsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${compId}/odds`;
    const odds = await fetchFn(oddsUrl).then(r => r.json()).catch(() => null);
    if (!odds) continue;

    // The odds payloads are sometimes arrays or have an { items: [] } shape.
    const providers: any[] = Array.isArray(odds) ? odds : (odds.items ?? []);
    const quotes: OddsQuote[] = [];

    for (const prov of providers) {
      // Provider name can be nested or expanded
      const providerName =
        prov?.provider?.name ??
        prov?.provider?.$ref ??
        prov?.name ??
        "Unknown";

      const updated =
        prov?.lastModified ??
        prov?.update ??
        new Date().toISOString();

      // --- Moneyline ---
      const moneylineGroups: any[] = prov?.moneylines ?? (prov?.moneyline ? [prov.moneyline] : []);
      for (const ml of moneylineGroups) {
        const m = ml?.moneyline ?? ml;
        const home = m?.home ?? m?.homeOdds ?? null;
        const away = m?.away ?? m?.awayOdds ?? null;
        if (home !== null && home !== undefined) {
          quotes.push({ book: providerName, market: "moneyline", team: "home", price: toNum(home), updated });
        }
        if (away !== null && away !== undefined) {
          quotes.push({ book: providerName, market: "moneyline", team: "away", price: toNum(away), updated });
        }
      }

      // --- Spread ---
      const spreadGroups: any[] = prov?.spreads ?? (prov?.spread ? [prov.spread] : []);
      for (const sp of spreadGroups) {
        const s = sp?.spread ?? sp;
        // try several common shapes
        const homeLine = s?.home ?? s?.spread?.home ?? null;
        const awayLine = s?.away ?? s?.spread?.away ?? null;
        const homeOdds = s?.odds?.home ?? s?.homeOdds ?? null;
        const awayOdds = s?.odds?.away ?? s?.awayOdds ?? null;

        if (homeLine !== null && homeOdds !== null) {
          quotes.push({
            book: providerName,
            market: "spread",
            team: "home",
            spread: toNum(homeLine),
            price: toNum(homeOdds),
            updated
          });
        }
        if (awayLine !== null && awayOdds !== null) {
          quotes.push({
            book: providerName,
            market: "spread",
            team: "away",
            spread: toNum(awayLine),
            price: toNum(awayOdds),
            updated
          });
        }
      }

      // --- Total ---
      const totalGroups: any[] = prov?.totals ?? (prov?.total ? [prov.total] : []);
      for (const tot of totalGroups) {
        const t = tot?.total ?? tot;
        const points = t?.points ?? t?.number ?? null;
        const over = t?.odds?.over ?? t?.over ?? null;
        const under = t?.odds?.under ?? t?.under ?? null;

        if (points !== null && over !== null) {
          quotes.push({
            book: providerName,
            market: "total",
            team: "over",
            total: toNum(points),
            price: toNum(over),
            updated
          });
        }
        if (points !== null && under !== null) {
          quotes.push({
            book: providerName,
            market: "total",
            team: "under",
            total: toNum(points),
            price: toNum(under),
            updated
          });
        }
      }
    }

    // 3) Compute “best price” per market/team across books
    const groups: Record<string, OddsQuote[]> = {};
    for (const q of quotes) {
      const k = `${q.market}:${q.team ?? ""}`;
      (groups[k] ??= []).push(q);
    }

    const best: Record<string, OddsQuote | null> = {};
    for (const [k, arr] of Object.entries(groups)) {
      if (k.startsWith("spread")) {
        // pick by best price for the given side
        best[k] = pickBestAmerican(arr);
      } else if (k.startsWith("total")) {
        best[k] = pickBestAmerican(arr);
      } else {
        // moneyline
        best[k] = pickBestAmerican(arr);
      }
    }

    results[eventId] = { quotes, best };
  }

  return results;
}

// Helpers
function toNum(v: any): number | null {
  const n = typeof v === "string" ? Number(v) : (typeof v === "number" ? v : NaN);
  return Number.isFinite(n) ? n : null;
}

// "Best" American odds = higher is better from bettor’s perspective (e.g., +150 beats +130; -105 beats -110)
function pickBestAmerican(arr: OddsQuote[]): OddsQuote | null {
  let best: OddsQuote | null = null;
  for (const q of arr) {
    if (q.price === null || q.price === undefined) continue;
    if (!best) { best = q; continue; }
    if (q.price > (best.price ?? -Infinity)) best = q;
  }
  return best;
}
