export class ArbitrageApiService {
  private apiKey: string;
  private host = "sportsbook-api2.p.rapidapi.com";
  private baseUrl = "https://sportsbook-api2.p.rapidapi.com/v0";

  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY || "";
    if (!this.apiKey) {
      console.warn("RAPIDAPI_KEY not set in environment variables");
    }
  }

  async getArbitrage(type = "ARBITRAGE"): Promise<any> {
    const url = `${this.baseUrl}/advantages/?type=${type}`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-host": this.host,
        "x-rapidapi-key": this.apiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`RapidAPI error: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }
}

export const arbitrageApiService = new ArbitrageApiService();
