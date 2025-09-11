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
    // Debug: show URL + status when DEBUG_SYNC=1
    if (process.env.DEBUG_SYNC === "1") {
      const safe = `${url}?key=***`;
      console.log("[fetch] URL:", safe);
    }

    const response = await fetch(`${url}?key=${this.apiKey}`);

    if (process.env.DEBUG_SYNC === "1") {
      console.log("[fetch] status:", response.status);
    }

    if (response.status === 429) {
      if (attempt <= 2) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        return this.fetchWithRetry(url, attempt + 1);
      }
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

  // Get available sports/leagues
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

  // Get odds for games
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
      return this.transformOddsData((Array.isArray(odds) ? odds : []).slice(0, limit), sport);
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error);
      const games = await this.getGames(sport);
      return games.slice(0, limit).map((g) => ({ ...g, bookmakers: [] }));
    }
  }

  // Get player stats (simple sample)
  async getPlayerStats(sport: string, season?: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) throw new Error(`Unsupported sport: ${sport}`);

    const currentSeason = season || this.getCurrentSeason(sport);
    const url = `${this.baseUrl}/${sportEndpoint}/scores/json/Players`;

    try {
      const players = await this.fetchWithRetry(url);
      return Array.isArray(players) ? players.slice(0, 50) : [];
    } catch (error) {
      console.error(`Error fetching player stats for ${sport}:`, error);
      return [];
    }
  }

  // Get team standings
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
      // SportsDataIO often returns a number here
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
      commence_time: g.DateTime || g.Day,
      home_team: g.HomeTeam || g.HomeTeamName || "Home Team",
      away_team: g.AwayTeam || g.AwayTeamName || "Away Team",
      completed: g.Status === "Final" || g.IsClosed === true,
      home_score: g.HomeScore ?? null,
      away_score: g.AwayScore ?? null,
      status: g.Status || "Scheduled",
      bookmakers: [],
    }));
  }

  private transformOddsData(oddsData: any[], sport: string): any[] {
    if (!Array.isArray(oddsData)) return [];

    return oddsData.map((game) => {
      const bookmakers: any[] = [];
      if (Array.isArray(game.PregameOdds)) {
        const bookMap = new Map<string, any>();

        game.PregameOdds.forEach((odd: any) => {
          const key = odd.Sportsbook || "unknown";
          if (!bookMap.has(key)) {
            bookMap.set(key, {
              key,
              title: odd.SportsbookName || key,
              last_update: odd.Created || new Date().toISOString(),
              markets: [],
            });
          }
          const bm = bookMap.get(key);

          // Moneyline
          if (odd.HomeMoneyLine || odd.AwayMoneyLine) {
            const outcomes: any[] = [];
            if (odd.HomeMoneyLine) {
              outcomes.push({
                name: game.HomeTeam || "Home",
                price: this.convertAmericanToDecimal(odd.HomeMoneyLine),
              });
            }
            if (odd.AwayMoneyLine) {
              outcomes.push({
                name: game.AwayTeam || "Away",
                price: this.convertAmericanToDecimal(odd.AwayMoneyLine),
              });
            }
            if (outcomes.length) {
              bm.markets.push({
                key: "h2h",
                last_update: odd.Created || new Date().toISOString(),
                outcomes,
              });
            }
          }

          // Spreads
          if (
            odd.PointSpread !== undefined ||
            odd.HomePointSpreadPayout !== undefined ||
            odd.AwayPointSpreadPayout !== undefined
          ) {
            const outcomes: any[] = [];
            if (odd.HomePointSpreadPayout != null && odd.PointSpread != null) {
              outcomes.push({
                name: game.HomeTeam || "Home",
                price: this.convertAmericanToDecimal(odd.HomePointSpreadPayout),
                point: -Math.abs(odd.PointSpread || 0),
              });
            }
            if (odd.AwayPointSpreadPayout != null && odd.PointSpread != null) {
              outcomes.push({
                name: game.AwayTeam || "Away",
                price: this.convertAmericanToDecimal(odd.AwayPointSpreadPayout),
                point: Math.abs(odd.PointSpread || 0),
              });
            }
            if (outcomes.length) {
              bm.markets.push({
                key: "spreads",
                last_update: odd.Created || new Date().toISOString(),
                outcomes,
              });
            }
          }

          // Totals
          if (odd.OverPayout != null || odd.UnderPayout != null) {
            const outcomes: any[] = [];
            if (odd.OverPayout != null && odd.OverUnder != null) {
              outcomes.push({
                name: "Over",
                price: this.convertAmericanToDecimal(odd.OverPayout),
                point: odd.OverUnder,
              });
            }
            if (odd.UnderPayout != null && odd.OverUnder != null) {
              outcomes.push({
                name: "Under",
                price: this.convertAmericanToDecimal(odd.UnderPayout),
                point: odd.OverUnder,
              });
            }
            if (outcomes.length) {
              bm.markets.push({
                key: "totals",
                last_update: odd.Created || new Date().toISOString(),
                outcomes,
              });
            }
          }
        });

        bookmakers.push(...Array.from(bookMap.values()));
      }

      return {
        id: game.GameID?.toString() || `${sport}_${Date.now()}_${Math.random()}`,
        sport_key: sport,
        sport_title: sport.toUpperCase(),
        commence_time: game.DateTime || game.Day,
        home_team: game.HomeTeam || game.HomeTeamName || "Home Team",
        away_team: game.AwayTeam || game.AwayTeamName || "Away Team",
        completed: game.Status === "Final" || game.IsClosed === true,
        home_score: game.HomeScore ?? null,
        away_score: game.AwayScore ?? null,
        status: game.Status || "Scheduled",
        bookmakers,
      };
    });
  }

  private convertAmericanToDecimal(americanOdds: number): number {
    return americanOdds > 0
      ? americanOdds / 100 + 1
      : 100 / Math.abs(americanOdds) + 1;
  }

  // Mock usage (SportsDataIO doesn’t expose it)
  async getApiUsage(): Promise<{ requests_used: number; requests_remaining: number }> {
    return { requests_used: 0, requests_remaining: 1000 };
  }
}

export const sportsDataIoService = new SportsDataIoService();
