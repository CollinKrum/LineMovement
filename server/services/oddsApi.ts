interface SportsGameOddsResponse {
  success: boolean;
  data: Array<{
    eventID: string;
    sportID: string;
    leagueID: string;
    type: string;
    teams: {
      home: {
        teamID: string;
        names: {
          short: string;
          medium: string;
          long: string;
        };
      };
      away: {
        teamID: string;
        names: {
          short: string;
          medium: string;
          long: string;
        };
      };
    };
    commenceTime: string;
    odds?: Record<string, any>;
  }>;
  nextCursor?: string;
}

interface LeagueResponse {
  success: boolean;
  data: Array<{
    leagueID: string;
    sportID: string;
    name: string;
    shortName: string;
    enabled: boolean;
  }>;
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
    if (!this.apiKey) {
      throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/leagues/`, {
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`SportsGameOdds API error: ${response.status} ${response.statusText}`);
      }

      const data: LeagueResponse = await response.json();
      
      // Transform to match expected format
      return data.data.map(league => ({
        key: league.leagueID,
        title: league.shortName || league.name,
        group: league.sportID,
        description: league.name,
        active: league.enabled,
        has_outrights: false
      }));
    } catch (error) {
      console.error('Error fetching sports:', error);
      throw error;
    }
  }

  async getOdds(sport: string, markets = 'h2h,spreads,totals'): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    }

    try {
      const url = new URL(`${this.baseUrl}/events/`);
      url.searchParams.set('leagueID', sport);
      url.searchParams.set('oddsAvailable', 'true');
      url.searchParams.set('includeAltLines', 'true');
      url.searchParams.set('limit', '50');

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`SportsGameOdds API error: ${response.status} ${response.statusText}`);
      }

      const data: SportsGameOddsResponse = await response.json();
      
      // Transform to match expected format
      return data.data.map(event => ({
        id: event.eventID,
        sport_key: event.leagueID,
        sport_title: event.leagueID.toUpperCase(),
        commence_time: event.commenceTime,
        home_team: event.teams?.home?.names?.medium || event.teams?.home?.teamID || 'Home Team',
        away_team: event.teams?.away?.names?.medium || event.teams?.away?.teamID || 'Away Team',
        bookmakers: this.transformOddsToBookmakers(event.odds || {})
      }));
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error);
      throw error;
    }
  }

  async getEventOdds(sport: string, eventId: string): Promise<any | null> {
    if (!this.apiKey) {
      throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    }

    try {
      const url = new URL(`${this.baseUrl}/events/`);
      url.searchParams.set('eventID', eventId);
      url.searchParams.set('includeAltLines', 'true');

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`SportsGameOdds API error: ${response.status} ${response.statusText}`);
      }

      const data: SportsGameOddsResponse = await response.json();
      
      if (!data.data || data.data.length === 0) {
        return null;
      }

      const event = data.data[0];
      return {
        id: event.eventID,
        sport_key: event.leagueID,
        sport_title: event.leagueID.toUpperCase(),
        commence_time: event.commenceTime,
        home_team: event.teams?.home?.names?.medium || event.teams?.home?.teamID || 'Home Team',
        away_team: event.teams?.away?.names?.medium || event.teams?.away?.teamID || 'Away Team',
        bookmakers: this.transformOddsToBookmakers(event.odds || {})
      };
    } catch (error) {
      console.error(`Error fetching event odds for ${eventId}:`, error);
      throw error;
    }
  }

  async getApiUsage(): Promise<{ requests_used: number; requests_remaining: number }> {
    if (!this.apiKey) {
      throw new Error('SPORTSGAMEODDS_API_KEY not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/account/usage`, {
        headers: {
          'x-api-key': this.apiKey
        }
      });
      
      if (!response.ok) {
        // If usage endpoint is not available, return default values
        return {
          requests_used: 0,
          requests_remaining: 1000
        };
      }

      const data = await response.json();
      
      return {
        requests_used: data.requests_used || 0,
        requests_remaining: data.requests_remaining || 1000,
      };
    } catch (error) {
      console.error('Error fetching API usage:', error);
      // Return default values on error
      return {
        requests_used: 0,
        requests_remaining: 1000
      };
    }
  }

  private transformOddsToBookmakers(odds: Record<string, any>): any[] {
    // SportsGameOdds uses a different format - transform to match expected structure
    const bookmakers: any[] = [];
    
    // Group odds by bookmaker
    const bookmakerMap = new Map();
    
    for (const [oddID, oddData] of Object.entries(odds)) {
      if (!oddData.bookmaker) continue;
      
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
      
      // Transform odds to outcomes format
      const outcomes = [];
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
