interface OddsApiResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      last_update: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

interface SportResponse {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export class OddsApiService {
  private apiKey: string;
  private baseUrl = 'https://api.the-odds-api.com/v4';

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('ODDS_API_KEY not found in environment variables');
    }
  }

  async getSports(): Promise<SportResponse[]> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/sports?apiKey=${this.apiKey}`);
      
      if (!response.ok) {
        throw new Error(`The Odds API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching sports:', error);
      throw error;
    }
  }

  async getOdds(sport: string, markets = 'h2h,spreads,totals'): Promise<OddsApiResponse[]> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    try {
      const url = new URL(`${this.baseUrl}/sports/${sport}/odds`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('regions', 'us');
      url.searchParams.set('markets', markets);
      url.searchParams.set('oddsFormat', 'american');
      url.searchParams.set('dateFormat', 'iso');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`The Odds API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching odds for ${sport}:`, error);
      throw error;
    }
  }

  async getEventOdds(sport: string, eventId: string): Promise<OddsApiResponse | null> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    try {
      const url = new URL(`${this.baseUrl}/sports/${sport}/events/${eventId}/odds`);
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('regions', 'us');
      url.searchParams.set('markets', 'h2h,spreads,totals');
      url.searchParams.set('oddsFormat', 'american');
      url.searchParams.set('dateFormat', 'iso');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`The Odds API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching event odds for ${eventId}:`, error);
      throw error;
    }
  }

  async getApiUsage(): Promise<{ requests_used: number; requests_remaining: number }> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/sports?apiKey=${this.apiKey}`);
      
      const requestsUsed = response.headers.get('x-requests-used');
      const requestsRemaining = response.headers.get('x-requests-remaining');
      
      return {
        requests_used: requestsUsed ? parseInt(requestsUsed) : 0,
        requests_remaining: requestsRemaining ? parseInt(requestsRemaining) : 0,
      };
    } catch (error) {
      console.error('Error fetching API usage:', error);
      throw error;
    }
  }
}

export const oddsApiService = new OddsApiService();
