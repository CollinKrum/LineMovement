// server/services/oddsApi.ts
type Json = any;

async function fetchJsonWith429Retry(url: string, apiKey: string, attempt = 1): Promise<Json> {
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });

  if (res.status === 429) {
    // brief, bounded backoff
    const retryAfterHdr = res.headers.get("retry-after");
    const retryAfter = retryAfterHdr ? Number(retryAfterHdr) : 2;
    if (attempt <= 2) {
      await new Promise(r => setTimeout(r, Math.min(5, Math.max(1, retryAfter)) * 1000));
      return fetchJsonWith429Retry(url, apiKey, attempt + 1);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `SportsGameOdds API error: ${res.status} ${res.statusText}${text ? ` - ${text.slice(0,300)}` : ""}`
    ) as any;
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

export class OddsApiService {
  private apiKey: string;
  private baseUrl = 'https://api.sportsgameodds.com/v2';

  constructor() {
    this.apiKey = process.env.SPORTSGAMEODDS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('SPORTSGAMEODDS_API_KEY not found in environment variables');
    }
  }

  async getSports(): Promise<any[]> {
    if (!this.apiKey) throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    const url = `${this.baseUrl}/leagues/`;
    const data = await fetchJsonWith429Retry(url, this.apiKey);
    // Transform to expected shape
    return (data?.data ?? []).map((league: any) => ({
      key: league.leagueID,
      title: league.shortName || league.name,
      group: league.sportID,
      description: league.name,
      active: league.enabled,
      has_outrights: false
    }));
  }

  // NOTE: signature supports limit & maxPages; routes.ts already passes these.
  async getOdds(sport: string, limit = 25, maxPages = 1): Promise<any[]> {
    if (!this.apiKey) throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    if (!sport) throw new Error('sport is required');

    const results: any[] = [];
    let cursor: string | undefined = undefined;

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL(`${this.baseUrl}/events/`);
      url.searchParams.set('leagueID', sport);
      url.searchParams.set('oddsAvailable', 'true');
      url.searchParams.set('includeAltLines', 'true');
      url.searchParams.set('limit', String(Math.max(1, Math.min(50, limit))));
      if (cursor) url.searchParams.set('cursor', cursor);

      const data = await fetchJsonWith429Retry(url.toString(), this.apiKey);

      const pageData: any[] = (data?.data ?? []).map((event: any) => ({
        id: event.eventID,
        sport_key: event.leagueID,
        sport_title: (event.leagueID || "").toUpperCase(),
        commence_time: event.commenceTime,
        home_team: event?.teams?.home?.names?.medium || event?.teams?.home?.teamID || 'Home Team',
        away_team: event?.teams?.away?.names?.medium || event?.teams?.away?.teamID || 'Away Team',
        bookmakers: this.transformOddsToBookmakers(event.odds || {})
      }));

      results.push(...pageData);

      cursor = data?.nextCursor;
      if (!cursor) break;            // no more pages
      if (results.length >= limit * maxPages) break; // hard cap safety
    }

    return results;
  }

  async getEventOdds(sport: string, eventId: string): Promise<any | null> {
    if (!this.apiKey) throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    const url = new URL(`${this.baseUrl}/events/`);
    url.searchParams.set('eventID', eventId);
    url.searchParams.set('includeAltLines', 'true');

    const data = await fetchJsonWith429Retry(url.toString(), this.apiKey);
    const ev = (data?.data ?? [])[0];
    if (!ev) return null;

    return {
      id: ev.eventID,
      sport_key: ev.leagueID,
      sport_title: (ev.leagueID || "").toUpperCase(),
      commence_time: ev.commenceTime,
      home_team: ev?.teams?.home?.names?.medium || ev?.teams?.home?.teamID || 'Home Team',
      away_team: ev?.teams?.away?.names?.medium || ev?.teams?.away?.teamID || 'Away Team',
      bookmakers: this.transformOddsToBookmakers(ev.odds || {})
    };
  }

  async getApiUsage(): Promise<{ requests_used: number; requests_remaining: number }> {
    if (!this.apiKey) throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    const url = `${this.baseUrl}/account/usage`;
    try {
      const data = await fetchJsonWith429Retry(url, this.apiKey);
      return {
        requests_used: data?.requests_used ?? 0,
        requests_remaining: data?.requests_remaining ?? 1000,
      };
    } catch {
      return { requests_used: 0, requests_remaining: 1000 };
    }
  }

  private transformOddsToBookmakers(odds: Record<string, any>): any[] {
    const bookmakerMap = new Map<string, any>();

    for (const [, oddData] of Object.entries(odds)) {
      if (!oddData || !oddData.bookmaker) continue;

      const bookmakerKey = oddData.bookmaker.key || 'unknown';
      const bookmakerTitle = oddData.bookmaker.title || 'Unknown Bookmaker';

      if (!bookmakerMap.has(bookmakerKey)) {
        bookmakerMap.set(bookmakerKey, {
          key: bookmakerKey,
          title: bookmakerTitle,
          last_update: oddData.last_update || new Date().toISOString(),
          markets: []
        });
      }

      const bookmaker = bookmakerMap.get(bookmakerKey);
      const outcomes: any[] = [];

      if (oddData.price && oddData.name) {
        outcomes.push({
          name: oddData.name,
          price: oddData.price,
          point: oddData.point
        });
      }

      if (outcomes.length > 0) {
        bookmaker.markets.push({
          key: oddData.betType || 'h2h',
          last_update: oddData.last_update || new Date().toISOString(),
          outcomes
        });
      }
    }

    return Array.from(bookmakerMap.values());
  }
}

export const oddsApiService = new OddsApiService();

