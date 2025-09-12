type OddsQuote = {
  book: string;
  market: "moneyline";
  team?: "home" | "away";
  price?: number | null;
  updated: string;
};

export async function getNflOddsToday(): Promise<
  Record<string, { quotes: OddsQuote[]; best: Record<string, OddsQuote | null> }>
> {
  const sb = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard").then(r => r.json());
  const out: Record<string, { quotes: OddsQuote[]; best: Record<string, OddsQuote | null> }> = {};

  for (const ev of sb?.events ?? []) {
    const eventId = ev?.id;
    const compId = ev?.competitions?.[0]?.id;
    if (!eventId || !compId) continue;

    const oddsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${compId}/odds`;
    let oddsRoot: any = null;
    try {
      oddsRoot = await fetch(oddsUrl).then(r => r.json());
    } catch {
      out[eventId] = { quotes: [], best: {} };
      continue;
    }

    const items: any[] = Array.isArray(oddsRoot) ? oddsRoot : (oddsRoot?.items ?? []);
    const quotes: OddsQuote[] = [];

    // Helper to fetch a linked resource if needed
    const expand = async (obj: any) => {
      const ref = obj?.$ref || obj?.href;
      if (ref && typeof ref === "string") {
        try { return await fetch(ref).then(r => r.json()); } catch { /* ignore */ }
      }
      return obj;
    };

    for (const item of items) {
      // Many ESPN core APIs return link shells; expand one hop
      const prov = await expand(item);

      const providerName =
        prov?.provider?.name ??
        prov?.provider?.$ref ??
        prov?.name ??
        prov?.displayName ??
        "Unknown";
      const updated = prov?.lastModified ?? prov?.update ?? new Date().toISOString();

      // --- Case A: direct moneyline shape { moneyline: { home: -110, away: +100 } }
      const ml = prov?.moneyline ?? null;
      if (ml && (ml.home != null || ml.away != null)) {
        if (ml.home != null) quotes.push({ book: providerName, market: "moneyline", team: "home", price: toNum(ml.home), updated });
        if (ml.away != null) quotes.push({ book: providerName, market: "moneyline", team: "away", price: toNum(ml.away), updated });
        continue; // go next provider
      }

      // --- Case B: markets array (look for moneyline)
      const markets: any[] = prov?.markets || prov?.odds || [];
      if (Array.isArray(markets) && markets.length) {
        for (const m0 of markets) {
          const m = await expand(m0); // sometimes each market is also a link
          const isMoneyline =
            /moneyline/i.test(String(m?.type ?? m?.key ?? m?.name ?? "")) ||
            String(m?.abbreviation ?? "").toLowerCase() === "ml";

          if (!isMoneyline) continue;

          const outcomes: any[] = Array.isArray(m?.outcomes) ? m.outcomes : [];
          for (const o0 of outcomes) {
            const o = await expand(o0);
            const team =
              (o?.homeAway === "home" || /home/i.test(o?.name)) ? "home" :
              (o?.homeAway === "away" || /away/i.test(o?.name)) ? "away" :
              undefined;

            const price = toNum(o?.price ?? o?.odds ?? o?.americanOdds);
            if (team && price != null) {
              quotes.push({ book: providerName, market: "moneyline", team, price, updated });
            }
          }
        }
      }
    }

    out[eventId] = { quotes, best: {} };
  }

  return out;
}

function toNum(v: any): number | null {
  const n = typeof v === "string" ? Number(v) : (typeof v === "number" ? v : NaN);
  return Number.isFinite(n) ? n : null;
}
