import { storage } from "../storage.js";
import { getNflOddsToday, transformEspnToDbFormat } from "../services/espnOdds.js";
import { sportsDataIoService } from "../services/sportsDataIoApi.js";

interface SyncResult {
  source: string;
  sport: string;
  gamesUpdated: number;
  oddsUpdated: number;
  booksUpdated: number;
  errors: string[];
  timestamp: Date;
}

export class OddsSyncJob {
  private isRunning = false;
  private lastSync: Date | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  async syncOddsForSport(sport: string, preferredSource?: string): Promise<SyncResult> {
    const result: SyncResult = {
      source: 'none',
      sport,
      gamesUpdated: 0,
      oddsUpdated: 0,
      booksUpdated: 0,
      errors: [],
      timestamp: new Date()
    };

    let data: any[] = [];

    // Try preferred source first
    if (preferredSource === 'ESPN' && sport === 'NFL') {
      try {
        const espnData = await getNflOddsToday();
        data = transformEspnToDbFormat(espnData, sport);
        result.source = 'ESPN';
      } catch (error: any) {
        result.errors.push(`ESPN: ${error.message}`);
      }
    } else if (preferredSource === 'SportsDataIO') {
      try {
        data = await sportsDataIoService.getOdds(sport, 50);
        result.source = 'SportsDataIO';
      } catch (error: any) {
        result.errors.push(`SportsDataIO: ${error.message}`);
      }
    }

    // Fallback logic
    if (data.length === 0) {
      // Try SportsDataIO as primary
      if (result.source !== 'SportsDataIO') {
        try {
          data = await sportsDataIoService.getOdds(sport, 50);
          result.source = 'SportsDataIO';
        } catch (error: any) {
          result.errors.push(`SportsDataIO fallback: ${error.message}`);
        }
      }

      // Try ESPN as fallback for NFL
      if (data.length === 0 && sport === 'NFL' && result.source !== 'ESPN') {
        try {
          const espnData = await getNflOddsToday();
          data = transformEspnToDbFormat(espnData, sport);
          result.source = 'ESPN';
        } catch (error: any) {
          result.errors.push(`ESPN fallback: ${error.message}`);
        }
      }
    }

    // Process and save data
    if (data.length > 0) {
      for (const event of data) {
        try {
          // Skip invalid events
          if (!event.home_team || !event.away_team || !event.commence_time) {
            continue;
          }

          // Upsert game
          await storage.upsertGame({
            id: event.id,
            sportId: sport,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            commenceTime: new Date(event.commence_time),
            completed: event.completed || false,
            homeScore: event.home_score ?? null,
            awayScore: event.away_score ?? null,
          });
          result.gamesUpdated++;

          // Process bookmakers and odds
          for (const bookmaker of event.bookmakers || []) {
            try {
              await storage.upsertBookmaker({
                id: bookmaker.key,
                title: bookmaker.title,
                lastUpdate: new Date(bookmaker.last_update || Date.now()),
              });
              result.booksUpdated++;

              for (const market of bookmaker.markets || []) {
                for (const outcome of market.outcomes || []) {
                  let outcomeType = "";

                  if (market.key === "h2h" || market.key === "moneyline") {
                    outcomeType = outcome.name === event.home_team || 
                                 outcome.name?.toLowerCase() === "home" ? "home" : "away";
                  } else if (market.key === "spreads") {
                    outcomeType = outcome.name === event.home_team || 
                                 outcome.name?.toLowerCase() === "home" ? "home" : "away";
                  } else if (market.key === "totals") {
                    outcomeType = outcome.name?.toLowerCase() === "over" || 
                                 outcome.name?.toLowerCase().includes("over") ? "over" : "under";
                  }

                  if (outcomeType) {
                    await storage.upsertOdds({
                      gameId: event.id,
                      bookmakerId: bookmaker.key,
                      market: market.key,
                      outcomeType,
                      price: String(outcome.price || 0),
                      point: outcome.point ? String(outcome.point) : null,
                    });
                    result.oddsUpdated++;
                  }
                }
              }
            } catch (error: any) {
              result.errors.push(`Bookmaker ${bookmaker.key}: ${error.message}`);
            }
          }
        } catch (error: any) {
          result.errors.push(`Event ${event.id}: ${error.message}`);
        }
      }
    }

    return result;
  }

  async syncAllSports(): Promise<SyncResult[]> {
    if (this.isRunning) {
      console.log('⚠️  Sync already in progress, skipping...');
      return [];
    }

    this.isRunning = true;
    const results: SyncResult[] = [];
    
    const sports = [
      { key: 'NFL', preferredSource: 'ESPN' },
      { key: 'NBA', preferredSource: 'SportsDataIO' },
      { key: 'MLB', preferredSource: 'SportsDataIO' },
      { key: 'NHL', preferredSource: 'SportsDataIO' },
    ];

    console.log(`🔄 Starting odds sync at ${new Date().toISOString()}`);

    for (const sport of sports) {
      try {
        console.log(`  Syncing ${sport.key}...`);
        const result = await this.syncOddsForSport(sport.key, sport.preferredSource);
        results.push(result);
        
        if (result.gamesUpdated > 0) {
          console.log(`  ✅ ${sport.key}: ${result.gamesUpdated} games, ${result.oddsUpdated} odds from ${result.source}`);
        } else if (result.errors.length > 0) {
          console.log(`  ⚠️  ${sport.key}: No data (${result.errors[0]})`);
        } else {
          console.log(`  ⚠️  ${sport.key}: No games found`);
        }

        // Small delay between sports to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`  ❌ ${sport.key}: Fatal error - ${error.message}`);
        results.push({
          source: 'none',
          sport: sport.key,
          gamesUpdated: 0,
          oddsUpdated: 0,
          booksUpdated: 0,
          errors: [error.message],
          timestamp: new Date()
        });
      }
    }

    this.lastSync = new Date();
    this.isRunning = false;

    // Log summary
    const totalGames = results.reduce((sum, r) => sum + r.gamesUpdated, 0);
    const totalOdds = results.reduce((sum, r) => sum + r.oddsUpdated, 0);
    console.log(`📊 Sync complete: ${totalGames} games, ${totalOdds} odds updated`);

    return results;
  }

  startScheduledSync(intervalMinutes: number = 5) {
    if (this.syncInterval) {
      console.log('⚠️  Scheduled sync already running');
      return;
    }

    console.log(`🚀 Starting scheduled odds sync every ${intervalMinutes} minutes`);
    
    // Run immediately
    this.syncAllSports().catch(console.error);

    // Schedule recurring syncs
    this.syncInterval = setInterval(() => {
      this.syncAllSports().catch(console.error);
    }, intervalMinutes * 60 * 1000);
  }

  stopScheduledSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Scheduled sync stopped');
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      scheduled: this.syncInterval !== null
    };
  }
}

// Create singleton instance
export const oddsSyncJob = new OddsSyncJob();

// Add sync endpoints to your routes
export function registerSyncRoutes(app: any) {
  // Manual sync endpoint
  app.post('/api/odds/sync-all', async (_req: any, res: any) => {
    try {
      const results = await oddsSyncJob.syncAllSports();
      res.json({
        success: true,
        results,
        summary: {
          totalGames: results.reduce((sum, r) => sum + r.gamesUpdated, 0),
          totalOdds: results.reduce((sum, r) => sum + r.oddsUpdated, 0),
          sources: [...new Set(results.map(r => r.source).filter(s => s !== 'none'))]
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Start scheduled sync
  app.post('/api/odds/sync/start', async (req: any, res: any) => {
    const { interval = 5 } = req.body;
    oddsSyncJob.startScheduledSync(interval);
    res.json({
      success: true,
      message: `Scheduled sync started (every ${interval} minutes)`,
      status: oddsSyncJob.getStatus()
    });
  });

  // Stop scheduled sync
  app.post('/api/odds/sync/stop', async (_req: any, res: any) => {
    oddsSyncJob.stopScheduledSync();
    res.json({
      success: true,
      message: 'Scheduled sync stopped',
      status: oddsSyncJob.getStatus()
    });
  });

  // Get sync status
  app.get('/api/odds/sync/status', async (_req: any, res: any) => {
    res.json({
      success: true,
      status: oddsSyncJob.getStatus()
    });
  });
}

// Auto-start sync if configured
if (process.env.AUTO_SYNC_ODDS === 'true') {
  const interval = parseInt(process.env.SYNC_INTERVAL_MINUTES || '5');
  setTimeout(() => {
    console.log('🚀 Auto-starting odds sync...');
    oddsSyncJob.startScheduledSync(interval);
  }, 5000); // Wait 5 seconds after server start
}
