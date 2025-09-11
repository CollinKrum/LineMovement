// src/services/sportsDataIoApi.ts
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
    // Optional debug
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

  async getGames(sport: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) throw new Error(`Unsupported sport: ${sport}`);

    const currentSeason = this.getCurrentSeason(sport);

    try {
      let url = `${this.baseUrl}/${sportEndpoint}/scores/json/Games/${currentSeason}`;

      // NFL / NCAAF use week-based endpoints
      if (sport.toUpperCase() === "NFL" || sport.toUpperCase() === "NCAAF") {
        const currentWeek = await this.getCurrentWeek(sportEndpoint);
        url = `${this.baseUrl}/${sportEndpoint}/scores/json/GamesByWeek/${currentSeason}/${currentWeek}`;
      }

      const games = await this.fetchWithRetry(url);
      return this.transformGames(games, sport);
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
      // Pass the sport as a fallback so sport_key/title are never null
      return this.transformOddsData(
        (Array.isArray(odds) ? odds : []).slice(0, limit),
        sport
      );
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error);
      // Graceful fallback: return skeleton events (no bookmakers)
      const games = await this.getGames(sport);
      return games.slice(0, limit).map((g) => ({ ...g, bookmakers: [] }));
    }
  }

  async getPlayerStats(sport: string, season?: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) throw new Error(`Unsupported sport: ${sport}`);

    // SDIO player endpoint often ignores season param; keep simple
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

  /**
   * Normalize odds payloads.
   * NOTE: This version never references an undefined variable
   * and safely guards every nested array access.
   */
  private transformOddsData(raw: any[], fallbackSportKey?: string) {
    if (!Array.isArray(raw)) return [];

    return raw.map((event: any) => {
      const bookmakers = Array.isArray(event.bookmakers)
        ? event.bookmakers.map((bm: any) => ({
            key: bm?.key ?? bm?.Key ?? "unknown",
            title: bm?.title ?? bm?.Title ?? bm?.key ?? "Unknown",
            last_update: bm?.last_update ?? bm?.LastUpdate ?? null,
            markets: Array.isArray(bm?.markets ?? bm?.Markets)
              ? (bm.markets ?? bm.Markets).map((m: any) => ({
                  key: m?.key ?? m?.Key ?? "h2h",
                  last_update: m?.last_update ?? m?.LastUpdate ?? bm?.last_update ?? null,
                  outcomes: Array.isArray(m?.outcomes ?? m?.Outcomes)
                    ? (m.outcomes ?? m.Outcomes).map((o: any) => ({
                        name: o?.name ?? o?.Name ?? null, // can be "Home", "Away", "Over", "Under" or team name
                        price: Number(o?.price ?? o?.Price),
                        point: o?.point ?? o?.Point ?? null,
                      }))
                    : [],
                }))
              : [],
          }))
        : [];

      return {
        id: event?.id ?? event?.GameID?.toString?.() ?? `${fallbackSportKey ?? "SPORT"}_${Date.now()}_${Math.random()}`,
        sport_key: event?.sport_key ?? event?.sportKey ?? event?.sport ?? fallbackSportKey ?? null,
        sport_title: event?.sport_title ?? event?.sportTitle ?? (fallbackSportKey ?? "") || null,
        commence_time: event?.commence_time ?? event?.commenceTime ?? event?.DateTime ?? null,
        home_team: event?.home_team ?? event?.homeTeam ?? event?.HomeTeam ?? null,
        away_team: event?.away_team ?? event?.awayTeam ?? event?.AwayTeam ?? null,
        completed: Boolean(event?.completed ?? event?.IsClosed),
        home_score: event?.home_score ?? event?.HomeScore ?? null,
        away_score: event?.away_score ?? event?.AwayScore ?? null,
        status: event?.status ?? event?.Status ?? "Scheduled",
        bookmakers,
      };
    });
  }

  private convertAmericanToDecimal(americanOdds: number): number {
    return americanOdds > 0
      ? americanOdds / 100 + 1
      : 100 / Math.abs(americanOdds) + 1;
  }

  // Mock usage (SportsDataIO doesn’t expose usage on all plans)
  async getApiUsage(): Promise<{ requests_used: number; requests_remaining: number }> {
    return { requests_used: 0, requests_remaining: 1000 };
  }
}

export const sportsDataIoService = new SportsDataIoService();
