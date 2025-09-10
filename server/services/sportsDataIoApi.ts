export class SportsDataIoService {
  private apiKey: string;
  private baseUrl = 'https://api.sportsdata.io/v3';

  constructor() {
    this.apiKey = process.env.SPORTSDATAIO_API_KEY || '7b7d6b984e5044069cad71fe96bc882e';
    if (!this.apiKey) {
      console.warn('SPORTSDATAIO_API_KEY not set in environment variables');
    }
  }

  private async fetchWithRetry(url: string, attempt = 1): Promise<any> {
    const response = await fetch(`${url}?key=${this.apiKey}`);
    
    if (response.status === 429) {
      if (attempt <= 2) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        return this.fetchWithRetry(url, attempt + 1);
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const error = new Error(
        `SportsDataIO API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.slice(0, 300)}` : ''}`
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
      { key: 'NFL', title: 'NFL', active: true, endpoint: 'nfl' },
      { key: 'NBA', title: 'NBA', active: true, endpoint: 'nba' },
      { key: 'MLB', title: 'MLB', active: true, endpoint: 'mlb' },
      { key: 'NHL', title: 'NHL', active: true, endpoint: 'nhl' },
      { key: 'NCAAF', title: 'College Football', active: true, endpoint: 'cfb' },
      { key: 'NCAAB', title: 'College Basketball', active: true, endpoint: 'cbb' },
      { key: 'MLS', title: 'MLS', active: true, endpoint: 'mls' },
      { key: 'WNBA', title: 'WNBA', active: true, endpoint: 'wnba' },
    ];

    return sports.map(sport => ({
      key: sport.key,
      title: sport.title,
      description: sport.title,
      active: sport.active,
      has_outrights: false
    }));
  }

  // Get games/schedules for a sport
  async getGames(sport: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) {
      throw new Error(`Unsupported sport: ${sport}`);
    }

    // Get current season/year
    const currentYear = new Date().getFullYear();
    const currentSeason = this.getCurrentSeason(sport);

    try {
      let url = `${this.baseUrl}/${sportEndpoint}/scores/json/Games/${currentSeason}`;
      
      // For some sports, we need different endpoints
      if (sport === 'NFL' || sport === 'NCAAF') {
        // Get current week
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
    if (!sportEndpoint) {
      throw new Error(`Unsupported sport: ${sport}`);
    }

    try {
      const currentSeason = this.getCurrentSeason(sport);
      let url = `${this.baseUrl}/${sportEndpoint}/odds/json/GameOddsByDate/${new Date().toISOString().split('T')[0]}`;

      const odds = await this.fetchWithRetry(url);
      
      return this.transformOddsData(odds.slice(0, limit), sport);
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error);
      // Fallback to games without odds
      const games = await this.getGames(sport);
      return games.slice(0, limit).map(game => ({
        ...game,
        bookmakers: []
      }));
    }
  }

  // Get player stats (bonus feature)
  async getPlayerStats(sport: string, season?: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) {
      throw new Error(`Unsupported sport: ${sport}`);
    }

    const currentSeason = season || this.getCurrentSeason(sport);
    const url = `${this.baseUrl}/${sportEndpoint}/scores/json/Players`;

    try {
      const players = await this.fetchWithRetry(url);
      return players.slice(0, 50); // Limit to prevent large responses
    } catch (error) {
      console.error(`Error fetching player stats for ${sport}:`, error);
      return [];
    }
  }

  // Get team standings
  async getStandings(sport: string): Promise<any[]> {
    const sportEndpoint = this.getSportEndpoint(sport);
    if (!sportEndpoint) {
      throw new Error(`Unsupported sport: ${sport}`);
    }

    const currentSeason = this.getCurrentSeason(sport);
    const url = `${this.baseUrl}/${sportEndpoint}/scores/json/Standings/${currentSeason}`;

    try {
      const standings = await this.fetchWithRetry(url);
      return standings;
    } catch (error) {
      console.error(`Error fetching standings for ${sport}:`, error);
      return [];
    }
  }

  private getSportEndpoint(sport: string): string | null {
    const endpoints: Record<string, string> = {
      'NFL': 'nfl',
      'NBA': 'nba', 
      'MLB': 'mlb',
      'NHL': 'nhl',
      'NCAAF': 'cfb',
      'NCAAB': 'cbb',
      'MLS': 'soccer',
      'WNBA': 'wnba'
    };
    
    return endpoints[sport.toUpperCase()] || null;
  }

  private getCurrentSeason(sport: string): string {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    switch (sport.toUpperCase()) {
      case 'NFL':
      case 'NCAAF':
        return currentMonth >= 8 ? currentYear.toString() : (currentYear - 1).toString();
      case 'NBA':
      case 'NCAAB':
        return currentMonth >= 10 ? currentYear.toString() : (currentYear - 1).toString();
      case 'MLB':
        return currentYear.toString();
      case 'NHL':
        return currentMonth >= 9 ? currentYear.toString() : (currentYear - 1).toString();
      default:
        return currentYear.toString();
    }
  }

  private async getCurrentWeek(sportEndpoint: string): Promise<number> {
    try {
      const url = `${this.baseUrl}/${sportEndpoint}/scores/json/CurrentWeek`;
      const weekData = await this.fetchWithRetry(url);
      return weekData?.Week || 1;
    } catch {
      return 1; // Default to week 1 if can't determine
    }
  }

  private transformGames(games: any[], sport: string): any[] {
    if (!Array.isArray(games)) return [];

    return games.map(game => ({
      id: game.GameID?.toString() || game.GameKey || `${sport}_${Date.now()}_${Math.random()}`,
      sport_key: sport,
      sport_title: sport.toUpperCase(),
      commence_time: game.DateTime || game.Day,
      home_team: game.HomeTeam || game.HomeTeamName || 'Home Team',
      away_team: game.AwayTeam || game.AwayTeamName || 'Away Team',
      completed: game.Status === 'Final' || game.IsClosed === true,
      home_score: game.HomeScore || null,
      away_score: game.AwayScore || null,
      status: game.Status || 'Scheduled',
      bookmakers: [] // Will be populated by odds data
    }));
  }

  private transformOddsData(oddsData: any[], sport: string): any[] {
    if (!Array.isArray(oddsData)) return [];

    return oddsData.map(game => {
      const bookmakers: any[] = [];

      // Transform SportsDataIO odds format to match our expected format
      if (game.PregameOdds && Array.isArray(game.PregameOdds)) {
        const bookmakerMap = new Map();

        game.PregameOdds.forEach((odd: any) => {
          const bookmakerKey = odd.Sportsbook || 'unknown';
          
          if (!bookmakerMap.has(bookmakerKey)) {
            bookmakerMap.set(bookmakerKey, {
              key: bookmakerKey,
              title: odd.SportsbookName || bookmakerKey,
              last_update: odd.Created || new Date().toISOString(),
              markets: []
            });
          }

          const bookmaker = bookmakerMap.get(bookmakerKey);

          // Money Line (H2H)
          if (odd.HomeMoneyLine || odd.AwayMoneyLine) {
            const outcomes = [];
            if (odd.HomeMoneyLine) {
              outcomes.push({
                name: game.HomeTeam || 'Home',
                price: this.convertAmericanToDecimal(odd.HomeMoneyLine)
              });
            }
            if (odd.AwayMoneyLine) {
              outcomes.push({
                name: game.AwayTeam || 'Away', 
                price: this.convertAmericanToDecimal(odd.AwayMoneyLine)
              });
            }
            
            if (outcomes.length > 0) {
              bookmaker.markets.push({
                key: 'h2h',
                last_update: odd.Created || new Date().toISOString(),
                outcomes
              });
            }
          }

          // Spread
          if (odd.PointSpread || odd.HomePointSpreadPayout || odd.AwayPointSpreadPayout) {
            const outcomes = [];
            if (odd.HomePointSpreadPayout && odd.PointSpread !== null) {
              outcomes.push({
                name: game.HomeTeam || 'Home',
                price: this.convertAmericanToDecimal(odd.HomePointSpreadPayout),
                point: -Math.abs(odd.PointSpread || 0)
              });
            }
            if (odd.AwayPointSpreadPayout && odd.PointSpread !== null) {
              outcomes.push({
                name: game.AwayTeam || 'Away',
                price: this.convertAmericanToDecimal(odd.AwayPointSpreadPayout),
                point: Math.abs(odd.PointSpread || 0)
              });
            }

            if (outcomes.length > 0) {
              bookmaker.markets.push({
                key: 'spreads',
                last_update: odd.Created || new Date().toISOString(),
                outcomes
              });
            }
          }

          // Totals (Over/Under)
          if (odd.OverPayout || odd.UnderPayout) {
            const outcomes = [];
            if (odd.OverPayout && odd.OverUnder !== null) {
              outcomes.push({
                name: 'Over',
                price: this.convertAmericanToDecimal(odd.OverPayout),
                point: odd.OverUnder
              });
            }
            if (odd.UnderPayout && odd.OverUnder !== null) {
              outcomes.push({
                name: 'Under',
                price: this.convertAmericanToDecimal(odd.UnderPayout),
                point: odd.OverUnder
              });
            }

            if (outcomes.length > 0) {
              bookmaker.markets.push({
                key: 'totals',
                last_update: odd.Created || new Date().toISOString(),
                outcomes
              });
            }
          }
        });

        bookmakers.push(...Array.from(bookmakerMap.values()));
      }

      return {
        id: game.GameID?.toString() || `${sport}_${Date.now()}_${Math.random()}`,
        sport_key: sport,
        sport_title: sport.toUpperCase(),
        commence_time: game.DateTime || game.Day,
        home_team: game.HomeTeam || game.HomeTeamName || 'Home Team',
        away_team: game.AwayTeam || game.AwayTeamName || 'Away Team',
        completed: game.Status === 'Final' || game.IsClosed === true,
        home_score: game.HomeScore || null,
        away_score: game.AwayScore || null,
        status: game.Status || 'Scheduled',
        bookmakers
      };
    });
  }

  private convertAmericanToDecimal(americanOdds: number): number {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    } else {
      return (100 / Math.abs(americanOdds)) + 1;
    }
  }

  // API usage information (mock since SportsDataIO doesn't provide this endpoint)
  async getApiUsage(): Promise<{ requests_used: number; requests_remaining: number }> {
    return {
      requests_used: 0,
      requests_remaining: 1000 // Most SportsDataIO plans have monthly limits
    };
  }
}

export const sportsDataIoService = new SportsDataIoService();

