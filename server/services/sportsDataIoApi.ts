export class SportsDataIoService {
  private apiKey: string;
  private baseUrl = "https://api.sportsdata.io/v3";

  constructor() {
    this.apiKey = process.env.SPORTSDATAIO_API_KEY || "";
    if (!this.apiKey) {
      console.warn("SPORTSDATAIO_API_KEY not set in environment variables");
    }
  }

  private async fetchWithRetry(url: string, attempt = 1): Promise<any> {
    if (process.env.DEBUG_SYNC === "1") {
      const safe = `${url}?key=***`;
      console.log("[fetch] URL:", safe);
    }

    const response = await fetch(`${url}?key=${this.apiKey}`);

    if (process.env.DEBUG_SYNC === "1") {
      console.log("[fetch] status:", response.status);
    }

    if (response.status === 429 && attempt <= 2) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return this.fetchWithRetry(url, attempt + 1);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      const error = new Error(
        `SportsDataIO API error: ${response.status} ${response.statusText}${
          errorText ? ` - ${errorText.slice(0, 300)}` : ""
        }`
      ) as any;
      error.status = response.status;
      error.body = errorText;
      throw error;
    }

    return response.json();
  }

  // ------------ Public API ------------

  async getSports(): Promise<any[]> {
    const sports = [
      { key: "NFL", title: "NFL", active: true, endpoint: "nfl" },
      { key: "NBA", title: "NBA", active: true, endpoint: "nba" },
      { key: "MLB", title: "MLB", active: true, endpoint: "mlb" },
      { key: "NHL", title: "NHL", active: true, endpoint: "nhl" },
      { key: "NCAAF", title: "College Football", active: true, endpoint: "cfb" },
      { key: "NCAAB", title: "College Basketball", active: true, endpoint: "cbb" },
      { key: "MLS", title: "MLS", active: true, endpoint: "soccer" },
      { key: "WNBA", title: "WNBA", active: true, endpoint: "wnba" },
    ];

    return sports.map((s) => ({
      key: s.key,
      title: s.title,
      description: s.title,
      active: s.active,
      has_outrights: false,
    }));
  }

  // Get games/schedules for a sport
async getGames(sport: string): Promise<any[]> {
  const sportEndpoint = this.getSportEndpoint(sport);
  if (!sportEndpoint) throw new Error(`Unsupported sport: ${sport}`);

  const currentSeason = this.getCurrentSeason(sport);

  try {
    // Prefer week-based for NFL / NCAAF
    if (sport.toUpperCase() === "NFL" || sport.toUpperCase() === "NCAAF") {
      const currentWeek = await this.getCurrentWeek(sportEndpoint);
      const weekUrl = `${this.baseUrl}/${sportEndpoint}/scores/json/GamesByWeek/${currentSeason}/${currentWeek}`;

      try {
        const gamesByWeek = await this.fetchWithRetry(weekUrl);
        return this.transformGames(gamesByWeek, sport);
      } catch (err: any) {
        // If that specific week 404s, fall back to the full season schedule
        if (err?.status === 404) {
          const schedUrl = `${this.baseUrl}/${sportEndpoint}/scores/json/Schedules/${currentSeason}`;
          const schedule = await this.fetchWithRetry(schedUrl);
          return this.transformGames(schedule, sport);
        }
        throw err;
      }
    }

    // Non week-based sports: use full season schedule directly
    const schedUrl = `${this.baseUrl}/${sportEndpoint}/scores/json/Schedules/${currentSeason}`;
    const schedule = await this.fetchWithRetry(schedUrl);
    return this.transformGames(schedule, sport);
  } catch (error) {
    console.error(`Error fetching games for ${sport}:`, error);
    return [];
  }
}

  async getOdds(sport: string, limit = 25): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) throw new Error(`Unsupported sport: ${sport}`);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const season = this.getCurrentSeason(sport);
      let url: string;

      switch (sport.toUpperCase()) {
        case "NFL":
        case "NCAAF": {
          const week = await this.getCurrentWeek(sportEndpoint);
          url = `${this.baseUrl}/${sportEndpoint}/odds/json/GameOddsByWeek/${season}/${week}`;
          break;
        }
        case "NBA":
        case "NCAAB":
        case "NHL":
        case "WNBA":
        case "MLB": {
          url = `${this.baseUrl}/${sportEndpoint}/odds/json/GameOddsByDate/${today}`;
          break;
        }
        default: {
          url = `${this.baseUrl}/${sportEndpoint}/odds/json/GameOddsByDate/${today}`;
        }
      }

      const odds = await this.fetchWithRetry(url);
      return this.transformOddsData(
        (Array.isArray(odds) ? odds : []).slice(0, limit),
        sport
      );
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error);
      const games = await this.getGames(sport);
      return games.slice(0, limit).map((g) => ({ ...g, bookmakers: [] }));
    }
  }

  async getPlayerStats(sport: string, season?: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) throw new Error(`Unsupported sport: ${sport}`);

    const url = `${this.baseUrl}/${sportEndpoint}/scores/json/Players`;

    try {
      const players = await this.fetchWithRetry(url);
      return Array.isArray(players) ? players.slice(0, 50) : [];
    } catch (error) {
      console.error(`Error fetching player stats for ${sport}:`, error);
      return [];
    }
  }

  async getStandings(sport: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) throw new Error(`Unsupported sport: ${sport}`);

    const currentSeason = this.getCurrentSeason(sport);
    const url = `${this.baseUrl}/${sportEndpoint}/scores/json/Standings/${currentSeason}`;

    try {
      const standings = await this.fetchWithRetry(url);
      return Array.isArray(standings) ? standings : [];
    } catch (error) {
      console.error(`Error fetching standings for ${sport}:`, error);
      return [];
    }
  }

  // ------------ Helpers ------------

  private getSportEndpoint(sport: string): string | null {
    const endpoints: Record<string, string> = {
      NFL: "nfl",
      NBA: "nba",
      MLB: "mlb",
      NHL: "nhl",
      NCAAF: "cfb",
      NCAAB: "cbb",
      MLS: "soccer",
      WNBA: "wnba",
    };
    return endpoints[sport.toUpperCase()] || null;
  }

  private getCurrentSeason(sport: string): string {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    switch (sport.toUpperCase()) {
      case "NFL":
      case "NCAAF":
        return currentMonth >= 8 ? `${currentYear}` : `${currentYear - 1}`;
      case "NBA":
      case "NCAAB":
        return currentMonth >= 10 ? `${currentYear}` : `${currentYear - 1}`;
      case "NHL":
        return currentMonth >= 9 ? `${currentYear}` : `${currentYear - 1}`;
      case "MLB":
      default:
        return `${currentYear}`;
    }
  }

  private async getCurrentWeek(sportEndpoint: string): Promise<number> {
    try {
      const url = `${this.baseUrl}/${sportEndpoint}/scores/json/CurrentWeek`;
      const week = await this.fetchWithRetry(url);
      return typeof week === "number" ? week : (week?.Week ?? 1);
    } catch {
      return 1;
    }
  }

  private transformGames(games: any[], sport: string): any[] {
    if (!Array.isArray(games)) return [];
    return games.map((g) => ({
      id: g.GameID?.toString() || g.GameKey || `${sport}_${Date.now()}_${Math.random()}`,
      sport_key: sport,
      sport_title: sport.toUpperCase(),
      commence_time: g.DateTime || g.Day || null,
      home_team: g.HomeTeam || g.HomeTeamName || "Home Team",
      away_team: g.AwayTeam || g.AwayTeamName || "Away Team",
      completed: g.Status === "Final" || g.IsClosed === true,
      home_score: g.HomeScore ?? null,
      away_score: g.AwayScore ?? null,
      status: g.Status || "Scheduled",
      bookmakers: [],
    }));
  }

  // Safe normalizer for odds payloads
private transformOddsData(raw: any[], fallbackSportKey?: string): any[] {
  const arr = Array.isArray(raw) ? raw : [];

  return arr.map((event: any) => {
    // -------- basic event fields --------
    const commence =
      event.commence_time ??
      event.commenceTime ??
      event.DateTime ??
      event.Day ??
      null;

    const homeTeam =
      event.home_team ??
      event.homeTeam ??
      event.HomeTeam ??
      event.HomeTeamName ??
      null;

    const awayTeam =
      event.away_team ??
      event.awayTeam ??
      event.AwayTeam ??
      event.AwayTeamName ??
      null;

    const id =
      event.id ??
      (event.GameID != null ? String(event.GameID) : undefined) ??
      (event.GameId != null ? String(event.GameId) : undefined) ??
      event.GameKey ??
      `${fallbackSportKey ?? "NFL"}_${Date.now()}_${Math.random()}`;

    const sportKey =
      event.sport_key ??
      event.sportKey ??
      event.sport ??
      (fallbackSportKey ?? "NFL");

    const sportTitle =
      event.sport_title ??
      event.sportTitle ??
      (fallbackSportKey ?? "NFL");

    // -------- “TheOddsAPI-style” bookmakers (pass through, keep American prices as strings) --------
    const fromOddsApi = Array.isArray(event.bookmakers ?? event.Bookmakers)
      ? (event.bookmakers ?? event.Bookmakers).map((bm: any) => ({
          key: bm.key ?? bm.Key ?? "unknown",
          title: bm.title ?? bm.Title ?? (bm.key ?? "Unknown"),
          last_update: bm.last_update ?? bm.LastUpdate ?? null,
          markets: (bm.markets ?? bm.Markets ?? []).map((m: any) => ({
            key: m.key ?? m.Key ?? "h2h",
            last_update: m.last_update ?? m.LastUpdate ?? (bm.last_update ?? null),
            outcomes: (m.outcomes ?? m.Outcomes ?? []).map((o: any) => ({
              name: o.name ?? o.Name ?? null,
              price: String(o.price ?? o.Price ?? ""), // keep American odds as string
              point: o.point ?? o.Point ?? null,
            })),
          })),
        }))
      : [];

    // -------- SportsDataIO PregameOdds -> synthesize bookmakers (keep American odds) --------
    const pregame = Array.isArray(event.PregameOdds) ? event.PregameOdds : [];
    const fromSdio = pregame.map((po: any) => {
      const sportsbook = po.Sportsbook ?? po.SportsBook ?? po.Source ?? "SportsDataIO";
      const updated = po.Updated ?? po.LastUpdated ?? null;

      // moneyline (h2h)
      const homeMl = po.HomeMoneyLine ?? po.HomeLine ?? po.MoneyLineHome ?? null;
      const awayMl = po.AwayMoneyLine ?? po.AwayLine ?? po.MoneyLineAway ?? null;

      const h2hOutcomes: any[] = [];
      if (homeMl !== null && homeMl !== undefined) {
        h2hOutcomes.push({ name: "home", price: String(homeMl), point: null });
      }
      if (awayMl !== null && awayMl !== undefined) {
        h2hOutcomes.push({ name: "away", price: String(awayMl), point: null });
      }

      // totals (over/under)
      const totalPoint =
        po.OverUnder ?? po.TotalNumber ?? po.Total ?? po.PointTotal ?? null;

      const overAmerican =
        po.OverPayout ?? po.OverOdds ?? po.OverPrice ?? po.OverMoneyLine ?? null;
      const underAmerican =
        po.UnderPayout ?? po.UnderOdds ?? po.UnderPrice ?? po.UnderMoneyLine ?? null;

      const totalsOutcomes: any[] = [];
      if (totalPoint != null && overAmerican != null) {
        totalsOutcomes.push({ name: "over", price: String(overAmerican), point: String(totalPoint) });
      }
      if (totalPoint != null && underAmerican != null) {
        totalsOutcomes.push({ name: "under", price: String(underAmerican), point: String(totalPoint) });
      }

      const markets: any[] = [];
      if (h2hOutcomes.length) {
        markets.push({ key: "h2h", last_update: updated, outcomes: h2hOutcomes });
      }
      if (totalsOutcomes.length) {
        markets.push({ key: "totals", last_update: updated, outcomes: totalsOutcomes });
      }

      return {
        key: sportsbook,
        title: sportsbook,
        last_update: updated,
        markets,
      };
    });

    const bookmakers = [...fromOddsApi, ...fromSdio].filter(
      (b) => Array.isArray(b.markets) && b.markets.length > 0
    );

  return {
      id,
      sport_key: sportKey,
      sport_title: sportTitle,
      commence_time: commence,
      home_team: homeTeam,
      away_team: awayTeam,
      completed: Boolean(
        event.completed || event.IsClosed === true || event.Status === "Final"
      ),
      home_score: event.home_score ?? event.HomeScore ?? null,
      away_score: event.away_score ?? event.AwayScore ?? null,
      status: event.status ?? event.Status ?? "Scheduled",
      bookmakers,
    };
  });
} // ✅ closes transformOddsData

} // ✅ closes the SportsDataIoService class

export const sportsDataIoService = new SportsDataIoService();
