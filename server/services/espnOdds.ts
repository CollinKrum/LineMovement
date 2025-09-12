// server/services/espnOdds.ts

// ===== Types =====
export type OddsQuote = {
  book: string;
  market: "moneyline";
  team?: "home" | "away";
  price?: number | null;
  updated: string;
};

type OddsResult = Record<string, { quotes: OddsQuote[]; best: Record<string, OddsQuote | null> }>;

// ===== Small fetch helpers =====
async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    return null;
  }
}

async function expandOne(obj: any): Promise<any> {
  const ref = obj?.$ref || obj?.href;
  if (typeof ref === "string") {
    const json = await getJson(ref);
    return json ?? obj;
  }
  return obj;
}

function toNum(v: any): number | null {
  const n = typeof v === "string" ? Number(v) : (typeof v === "number" ? v : NaN);
  return Number.isFinite(n) ? n : null;
}

// Try to resolve competition id from the event link if not provided
async function resolveCompetitionId(eventId: string): Promise<string> {
  const base = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
  const ev = await getJson(`${base}/events/${eventId}`);
  const compRef = ev?.competitions?.[0]?.$ref;
  if (typeof compRef === "string") {
    const comp = await getJson(compRef);
    const cid = comp?.id ?? compRef.split("/").pop();
    if (cid) return String(cid);
  }
  // fallback: often compId === eventId
  return eventId;
}

// ===== Public: odds fetcher (moneyline only for first pass) =====
export async function getNflOddsToday(): Promise<OddsResult> {
  const sb = await getJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  const out: OddsResult = {};
  if (!sb?.events?.length) return out;

  for (const ev of sb.events) {
    const eventId: string | undefined = ev?.id;
    let compId: string | undefined = ev?.competitions?.[0]?.id;
    if (!eventId) continue;

    // Be robust: resolve compId if missing
    if (!compId) compId = await resolveCompetitionId(eventId);

    const oddsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${eventId}/competitions/${compId}/odds`;
    const oddsRoot = await getJson(oddsUrl);

    const items: any[] =
      Array.isArray(oddsRoot) ? oddsRoot :
      Array.isArray(oddsRoot?.items) ? oddsRoot.items :
      [];

    const quotes: OddsQuote[] = [];

    for (const item of items) {
      // Provider objects are usually link shells — expand one hop
      const prov = await expandOne(item);

      const providerName =
        prov?.provider?.name ??
        prov?.provider?.displayName ??
        prov?.provider?.$ref ??
        prov?.name ??
        prov?.displayName ??
        "Unknown";

      const updated =
        prov?.lastModified ??
        prov?.update ??
        new Date().toISOString();

      // --- Case A: direct moneyline { moneyline: { home, away } } ---
      const ml = prov?.moneyline ?? null;
      if (ml && (ml.home != null || ml.away != null)) {
        if (ml.home != null) quotes.push({ book: providerName, market: "moneyline", team: "home", price: toNum(ml.home), updated });
        if (ml.away != null) quotes.push({ book: providerName, market: "moneyline", team: "away", price: toNum(ml.away), updated });
        continue;
      }

      // --- Case B: markets array — look for moneyline ---
      const markets: any[] = Array.isArray(prov?.markets) ? prov.markets :
                             Array.isArray(prov?.odds)    ? prov.odds    : [];
      if (!markets.length) continue;

      for (const m0 of markets) {
        const m = await expandOne(m0); // sometimes each market is a link shell too

        const label = String(m?.type ?? m?.key ?? m?.name ?? m?.abbreviation ?? "").toLowerCase();
        const isMoneyline = label.includes("moneyline") || label === "ml";
        if (!isMoneyline) continue;

        const outcomes: any[] = Array.isArray(m?.outcomes) ? m.outcomes : [];
        for (const o0 of outcomes) {
          const o = await expandOne(o0);
          const team: "home" | "away" | undefined =
            o?.homeAway === "home" ? "home" :
            o?.homeAway === "away" ? "away" :
            /home/i.test(o?.name ?? "") ? "home" :
            /away/i.test(o?.name ?? "") ? "away" : undefined;

          const price = toNum(o?.price ?? o?.odds ?? o?.americanOdds);
          if (team && price != null) {
            quotes.push({ book: providerName, market: "moneyline", team, price, updated });
          }
        }
      }
    }

    out[eventId] = { quotes, best: {} };
  }

  return out;
}

// ===== DEBUG helper: inspect odds payloads =====
// If compId is omitted, it will be resolved. Set expand=true to follow a few provider links.
export async function _debugFetchEspnOddsRaw(
  eventId: string,
  compId?: string,
  expand: boolean = true,
  maxProviders: number = 5
) {
  const base = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

  async function getJsonWithMeta(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* ignore parse */ }
    return { url, status: res.status, ok: res.ok, text, json };
  }

  // 1) Resolve comp id if needed
  if (!compId) {
    const ev = await getJsonWithMeta(`${base}/events/${eventId}`);
    const compRef = ev.json?.competitions?.[0]?.$ref;
    if (typeof compRef === "string") {
      const comp = await getJsonWithMeta(compRef);
      compId = comp.json?.id ?? (compRef.split("/").pop() || eventId);
    } else {
      compId = eventId;
    }
  }

  // 2) Grab odds root
  const oddsUrl = `${base}/events/${eventId}/competitions/${compId}/odds`;
  const root = await getJsonWithMeta(oddsUrl);

  const items: any[] =
    Array.isArray(root.json) ? root.json :
    Array.isArray(root.json?.items) ? root.json.items :
    [];

  // 3) Optionally expand a few providers to see real payload
  const expandedSample: Array<Record<string, any>> = [];
  if (expand && items.length) {
    for (const it of items.slice(0, Math.max(1, maxProviders))) {
      const link = it?.$ref || it?.href || it?.provider?.$ref || it?.odds?.$ref || null;
      if (typeof link === "string") {
        const ex = await getJsonWithMeta(link);
        expandedSample.push({
          href: link,
          status: ex.status,
          ok: ex.ok,
          keys: ex.json ? Object.keys(ex.json) : [],
          sample: ex.json ?? ex.text?.slice(0, 4000),
        });
      } else {
        expandedSample.push({
          inline: true,
          keys: Object.keys(it ?? {}),
          sample: it,
        });
      }
    }
  }

  return {
    ok: root.ok,
    eventId,
    compId,
    url: root.url,
    status: root.status,
    itemsCount: items.length,
    expandedSample,
    rawTrimmed: root.text?.slice(0, 8000),
  };
}
