// server/services/oddsApi.ts
type Json = Record<string, any>;

interface SportsGameOddsEvent {
  eventID: string;
  sportID?: string;
  leagueID: string;
  type?: string;
  teams?: {
    home?: {
      teamID?: string;
      names?: { short?: string; medium?: string; long?: string };
    };
    away?: {
      teamID?: string;
      names?: { short?: string; medium?: string; long?: string };
    };
  };
  commenceTime: string;      // ISO
  odds?: Record<string, any>; // provider-specific blob
}

interface SportsGameOddsEventsResponse {
  success: boolean;
  data: SportsGameOddsEvent[];
  nextCursor?: string | null;
}

interface SportsGameOddsLeague {
  leagueID: string;     // e.g. "NFL", "NBA"
  sportID: string;      // e.g. "FOOTBALL", "BASKETBALL"
  name: string;
  shortName?: string;
  enabled: boolean;
}

interface SportsGameOddsLeaguesResponse {
  success: boolean;
  data: SportsGameOddsLeague[];
}

const BASE_URL = "https://api.sportsgameodds.com/v2";

function assertApiKey(): string {
  const apiKey = process.env.SPORTSGAMEODDS_API_KEY || "";
  if (!apiKey) {
    throw new Error("SPORTSGAMEODDS_API_KEY not configured");
  }
  return apiKey;
}

async function fetchJson(url: string, apiKey: string): Promise<Json> {
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = `SportsGameOdds API error: ${res.status} ${res.statusText}${
      text ? ` - ${text.slice(0, 300)}` : ""
    }`;
    const err = new Error(message) as Error & { status?: number; body?: string };
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return (await res.json()) as Json;
}

function safeTeamName(team?: { teamID?: string; names?: { medium?: string; short?: string; long?: string } }): string {
  return (
    team?.names?.medium ||
    team?.names?.short ||
    team?.names?.long ||
    team?.teamID ||
    "Unknown Team"
  );
}

/**
 * Transform SGO "odds" map into our canonical bookmakers array.
 * We’re defensive here since SGO’s structure can vary by market/sport.
 */
function transformOddsToBookmakers(odds: Record<string, any> | undefined): any[] {
  if (!odds || typeof odds !== "object") return [];

  // bookmakerKey -> { key, title, last_update, markets: [] }
  const map = new Map<
    string,
    { key: string; title: string; last_update: string; markets: Array<{ key: string; last_update: string; outcomes: Array<{ name: string; price: number | string; point?: number | string | null }> }> }
  >();

  for (const [, node] of Object.entries(odds)) {
    const bookmakerKey = (node?.bookmaker?.key as string) || "unknown";
    const bookmakerTitle = (node?.bookmaker?.title as string) || "Unknown Bookmaker";
    const lastUpdate = (node?.last_update as string) || new Date().toISOString();
    const marketKey = (node?.betType as string) || "h2h";

    if (!map.has(bookmakerKey)) {
      map.set(bookmakerKey, { key: bookmakerKey, title: bookmakerTitle, last_update: lastUpdate, markets: [] });
    }
    const book = map.get(bookmakerKey)!;

    const outcomes: Array<{ name: string; price: number | string; point?: number | string | null }> = [];

    // common shapes we’ve seen:
    // - node.price + node.name (+ node.point)
    // - node.outcomes: [{ name, price, point }]
    if (node?.outcomes && Array.isArray(node.outcomes)) {
      for (const o of node.outcomes) {
        if (o?.name != null && o?.price != null) {
          outcomes.push({ name: String(o.name), price: o.price, point: o.point ?? null });
        }
      }
    } else if (node?.price != null && node?.name != null) {
      outcomes.push({ name: String(node.name), price: node.price, point: node.point ?? null });
    }

    if (outcomes.length > 0) {
      book.markets.push({
        key: marketKey,
        last_update: lastUpdate,
        outcomes,
      });
    }
  }

  return Array.from(map.values());
}

export class OddsApiService {
  private apiKey: string;

  constructor() {
    this.apiKey = assertApiKey();
  }

  /** List leagues => normalize to your "sports" format */
  async getSports(): Promise<
    Array<{ key: string; title: string; group: string; description: string; active: boolean; has_outrights: boolean }>
  > {
    const url = `${BASE_URL}/leagues`; // trailing slash ok, but not required
    const data = (await fetchJson(url, this.apiKey)) as SportsGameOddsLeaguesResponse;

    if (!data?.success || !Array.isArray(data.data)) return [];

    return data.data.map((league) => ({
      key: league.leagueID,                                     // e.g. "NFL"
      title: league.shortName || league.name,                   // e.g. "NFL"
      group: league.sportID,                                    // e.g. "FOOTBALL"
      description: league.name,                                 // full name
      active: !!league.enabled,
      has_outrights: false,
    }));
  }

  /**
   * Fetch odds for a league (supports pagination via nextCursor).
   * @param sport League ID (e.g. "NFL", "NBA")
   * @param limitPerPage default 50 (SGO typical)
   * @param maxPages safety cap to avoid runaway pagination
   */
  async getOdds(sport: string, limitPerPage = 50, maxPages = 5): Promise<any[]> {
    if (!sport) throw new Error("Missing sport (leagueID) for getOdds");

    let cursor: string | null | undefined = null;
    let page = 0;
    const all: any[] = [];

    do {
      const url = new URL(`${BASE_URL}/events`);
      url.searchParams.set("leagueID", sport);
      url.searchParams.set("oddsAvailable", "true");
      url.searchParams.set("includeAltLines", "true");
      url.searchParams.set("limit", String(limitPerPage));
      if (cursor) url.searchParams.set("cursor", cursor);

      const json = (await fetchJson(url.toString(), this.apiKey)) as SportsGameOddsEventsResponse;

      const batch = (json?.data ?? []).map((event) => ({
        id: event.eventID,
        sport_key: event.leagueID,
        sport_title: (event.leagueID || "").toUpperCase(),
        commence_time: event.commenceTime,
        home_team: safeTeamName(event.teams?.home),
        away_team: safeTeamName(event.teams?.away),
        bookmakers: transformOddsToBookmakers(event.odds),
      }));

      all.push(...batch);
      cursor = json?.nextCursor || null;
      page += 1;
    } while (cursor && page < maxPages);

    return all;
  }

  /** Fetch one event by ID */
  async getEventOdds(_sport: string, eventId: string): Promise<any | null> {
    if (!eventId) throw new Error("Missing eventId for getEventOdds");

    const url = new URL(`${BASE_URL}/events`);
    url.searchParams.set("eventID", eventId);
    url.searchParams.set("includeAltLines", "true");

    const json = (await fetchJson(url.toString(), this.apiKey)) as SportsGameOddsEventsResponse;
    const event = json?.data?.[0];
    if (!event) return null;

    return {
      id: event.eventID,
      sport_key: event.leagueID,
      sport_title: (event.leagueID || "").toUpperCase(),
      commence_time: event.commenceTime,
      home_team: safeTeamName(event.teams?.home),
      away_team: safeTeamName(event.teams?.away),
      bookmakers: transformOddsToBookmakers(event.odds),
    };
  }

  /** Best effort account usage (SGO may not expose everything) */
  async getApiUsage(): Promise<{ requests_used: number; requests_remaining: number }> {
    try {
      const url = `${BASE_URL}/account/usage`;
      const json = await fetchJson(url, this.apiKey);
      return {
        requests_used: Number(json?.requests_used ?? 0),
        requests_remaining: Number(json?.requests_remaining ?? 1000),
      };
    } catch {
      // Not fatal; return defaults
      return { requests_used: 0, requests_remaining: 1000 };
    }
  }
}

export const oddsApiService = new OddsApiService();

