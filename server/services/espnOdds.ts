type OddsQuote = {
  book: string;
  market: string;
  team?: string;
  price?: number | null;
  updated: string;
};

export async function getNflOddsToday(): Promise<
  Record<string, { quotes: OddsQuote[]; best: Record<string, OddsQuote | null> }>
> {
  const sb = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard")
    .then(r => r.json());

  const results: Record<string, { quotes: OddsQuote[]; best: Record<string, OddsQuote | null> }> = {};

  for (const ev of sb.events ?? []) {
    const eventId = ev.id;
    const comp = ev.competitions?.[0];
    if (!eventId || !comp?.id) continue;

    const compId = comp.id;
    const oddsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${compId}/odds`;

    let odds: any;
    try {
      odds = await fetch(oddsUrl).then(r => r.json());
    } catch {
      continue;
    }

    const providers: any[] = Array.isArray(odds) ? odds : (odds.items ?? []);
    const quotes: OddsQuote[] = [];

    for (const prov of providers) {
      const providerName =
        prov?.provider?.name ??
        prov?.provider?.$ref ??
        prov?.name ??
        "Unknown";

      const updated =
        prov?.lastModified ??
        prov?.update ??
        new Date().toISOString();

      // Example: just collect any moneyline odds we can find
      const moneyline = prov?.moneyline ?? null;
      if (moneyline?.home) {
        quotes.push({ book: providerName, market: "moneyline", team: "home", price: Number(moneyline.home), updated });
      }
      if (moneyline?.away) {
        quotes.push({ book: providerName, market: "moneyline", team: "away", price: Number(moneyline.away), updated });
      }
    }

    results[eventId] = { quotes, best: {} };
  }

  return results;
}
