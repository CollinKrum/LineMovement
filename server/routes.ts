import type { Express } from "express";
import { storage } from "./storage.js";
import { sportsDataIoService } from "./services/sportsDataIoApi.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getNflOddsToday, transformEspnToDbFormat, debugEspnOdds } from "./services/espnOdds.js";

/** Register API routes on the provided Express app. */
export function registerRoutes(app: Express): Express {
  // --- Combined health check (app + DB) ---
  app.get("/api/health", async (_req, res) => {
    const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
    try {
      const probe = await db.execute(sql`select 1 as db_ok`);
      const dbOk = Array.isArray((probe as any)?.rows) ? true : !!(probe as any)?.rowCount;

      res.json({
        ok: true,
        app: { status: "up", uptimeSeconds: Math.round(process.uptime()), startedAt },
        db: { ok: dbOk }
      });
    } catch (err: any) {
      res.status(503).json({
        ok: false,
        app: { status: "up", uptimeSeconds: Math.round(process.uptime()), startedAt },
        db: { ok: false, error: String(err?.message || err) }
      });
    }
  });

  // --- DB ping (debug) ---
  app.get("/api/_debug/ping-db", async (_req, res) => {
    try {
      const result = await db.execute(
        sql`select current_catalog as db, current_user as "user", inet_server_addr()::text as host`
      );
      res.json({ ok: true, result });
    } catch (err: any) {
      console.error("DB ping failed:", err);
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  });

  // --- Debug SportsDataIO config ---
  app.get("/api/_debug/sportsdata-config", async (_req, res) => {
    try {
      const hasSportsDataIO = Boolean(process.env.SPORTSDATAIO_API_KEY);
      const sports = await storage.getSports().catch(() => []);
      const keys = Array.isArray(sports)
        ? sports.map((s: any) => s.id ?? s.key).filter(Boolean)
        : [];

      res.json({
        ok: true,
        env: {
          SPORTSDATAIO_API_KEY_set: hasSportsDataIO,
        },
        knownSportKeys: keys.slice(0, 50),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  });

  // --- Quick sample pull from SportsDataIO ---
  app.get("/api/_debug/sportsdata-games", async (req, res) => {
    try {
      const sport = (req.query.sport as string) || "NFL";
      const games = await sportsDataIoService.getGames(sport);
      res.json({
        ok: true,
        sport,
        count: games.length,
        sample: games.slice(0, 2),
        provider: "SportsDataIO"
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: String(error?.message || error),
        status: error?.status ?? null,
        provider: "SportsDataIO"
      });
    }
  });

  // =========================
  // Sports (SportsDataIO)
  // =========================
  app.get("/api/sports", async (_req, res) => {
    try {
      const sports = await storage.getSports();
      res.json(sports);
    } catch (error) {
      console.error("Error fetching sports:", error);
      res.status(500).json({ message: "Failed to fetch sports" });
    }
  });

  app.post("/api/sports/sync", async (_req, res) => {
    try {
      const sports = await sportsDataIoService.getSports();
      for (const sport of sports) {
        await storage.upsertSport({
          id: sport.key,
          title: sport.title,
          description: sport.description,
          active: sport.active,
          hasOutrights: sport.has_outrights,
        });
      }
      res.json({
        message: `Synced ${sports.length} sports`,
        provider: "SportsDataIO"
      });
    } catch (error) {
      console.error("Error syncing sports:", error);
      res.status(500).json({ message: "Failed to sync sports" });
    }
  });

  // =========================
  // Games & Odds (SportsDataIO)
  // =========================
  app.get("/api/games", async (req, res) => {
    try {
      const { sport } = req.query;
      const games =
        sport && typeof sport === "string"
          ? await storage.getGamesBySport(sport)
          : await storage.getUpcomingGames();
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  // NEW: GET /api/odds?sport=NFL&limit=25
  app.get("/api/odds", async (req, res, next) => {
    try {
      const sport = (req.query.sport as string) || "NFL";
      const limit = Math.max(1, parseInt(String(req.query.limit ?? "25"), 10));
      const odds = await sportsDataIoService.getOdds(sport, limit);
      res.json(odds);
    } catch (err) {
      next(err);
    }
  });

  // Pull odds from SportsDataIO and upsert into DB
  app.post("/api/odds/sync", async (req, res) => {
    try {
      const { sport } = req.body as { sport?: string };
      if (!sport) return res.status(400).json({ message: "Sport parameter is required" });

      const limit = Math.max(1, parseInt(String(req.query.limit ?? "25"), 10));
      // inside app.post("/api/odds/sync", async (req, res) => { ... })

      let gamesUpdated = 0;
      let oddsUpdated = 0;
      let gamesSkipped = 0; // <— track skips

      const oddsData = await sportsDataIoService.getOdds(sport, limit);

      for (const event of oddsData) {
        // Hard guard: don’t write invalid rows
        if (!event?.home_team || !event?.away_team || !event?.commence_time) {
          gamesSkipped++;
          continue;
        }

        const commenceTime = new Date(event.commence_time);
        if (isNaN(commenceTime.getTime())) {
          gamesSkipped++;
          continue;
        }

        await storage.upsertGame({
          id: event.id,
          sportId: event.sport_key,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          commenceTime,
          completed: Boolean(event.completed),
          homeScore: event.home_score ?? null,
          awayScore: event.away_score ?? null,
        });
        gamesUpdated++;

        // Bookmakers may be empty for some SportsDataIO plans — that’s fine
        for (const bm of event.bookmakers || []) {
          const lastUpdate = bm.last_update ? new Date(bm.last_update) : new Date();
          if (isNaN(lastUpdate.getTime())) continue;

          await storage.upsertBookmaker({
            id: bm.key,
            title: bm.title,
            lastUpdate,
          });

          for (const market of bm.markets || []) {
            for (const outcome of market.outcomes || []) {
              let outcomeType = "";

              if (market.key === "h2h" || market.key === "spreads") {
                const n = String(outcome.name || "").toLowerCase();
                const home = String(event.home_team || "").toLowerCase();
                const away = String(event.away_team || "").toLowerCase();

                const isHome = n === "home" || n.includes("home") || n === home || (home && n.includes(home));
                const isAway = n === "away" || n.includes("away") || n === away || (away && n.includes(away));

                if (isHome) outcomeType = "home";
                else if (isAway) outcomeType = "away";
              } else if (market.key === "totals") {
                const n = String(outcome.name || "").toLowerCase();
                outcomeType = n === "over" ? "over" : n === "under" ? "under" : "";
              }

              if (!outcomeType) continue;

              await storage.upsertOdds({
                gameId: event.id,
                bookmakerId: bm.key,
                market: market.key,
                outcomeType,
                price: String(outcome.price),
                point: outcome.point != null ? String(outcome.point) : null,
              });
              oddsUpdated++;
            }
          }
        }
      }

      return res.json({
        message: `Synced ${gamesUpdated} games and ${oddsUpdated} odds entries`,
        sport,
        limit,
        gamesUpdated,
        oddsUpdated,
        gamesSkipped, // <— visible in response for transparency
        provider: "SportsDataIO",
      });
    } catch (error: any) {
      console.error("Error syncing odds:", error);
      res.status(500).json({ message: "Failed to sync odds" });
    }
  });

  // =========================
  // ESPN (undocumented) odds — backup feed
  // =========================
  app.get("/api/espn/nfl/odds", async (_req, res) => {
    try {
      console.log('📡 Fetching ESPN NFL odds...');
      const data = await getNflOddsToday();
      
      // Add summary stats to response
      const eventCount = Object.keys(data).length;
      let totalQuotes = 0;
      const bookmakers = new Set<string>();
      
      for (const event of Object.values(data)) {
        totalQuotes += event.quotes.length;
        event.quotes.forEach(q => bookmakers.add(q.book));
      }
      
      res.json({
        success: true,
        summary: {
          events: eventCount,
          totalQuotes,
          bookmakers: bookmakers.size,
          books: Array.from(bookmakers),
        },
        data
      });
    } catch (error: any) {
      console.error('ESPN odds error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to fetch ESPN odds",
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  // Get ESPN odds in your DB format
  app.get("/api/espn/nfl/odds/formatted", async (_req, res) => {
    try {
      const espnData = await getNflOddsToday();
      const formatted = transformEspnToDbFormat(espnData, "NFL");
      
      res.json({
        success: true,
        count: formatted.length,
        data: formatted
      });
    } catch (error: any) {
      console.error('ESPN formatted odds error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to format ESPN odds"
      });
    }
  });

  // Debug endpoint for ESPN
  app.get("/api/espn/debug", async (_req, res) => {
    try {
      const debugInfo = await debugEspnOdds();
      res.json({
        success: true,
        debug: true,
        data: debugInfo
      });
    } catch (error: any) {
      console.error('ESPN debug error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Debug failed"
      });
    }
  });

  // Sync ESPN odds to your database
  app.post("/api/espn/nfl/sync", async (req, res) => {
    try {
      const { limit = 10 } = req.body;
      
      console.log('🔄 Syncing ESPN NFL odds to database...');
      
      // Fetch from ESPN
      const espnData = await getNflOddsToday();
      const formatted = transformEspnToDbFormat(espnData, "NFL");
      
      let gamesUpdated = 0;
      let oddsUpdated = 0;
      let booksUpdated = 0;
      
      // Process each event
      for (const event of formatted.slice(0, limit)) {
        if (!event.home_team || !event.away_team) continue;
        
        // Upsert game
        await storage.upsertGame({
          id: event.id,
          sportId: "NFL",
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          commenceTime: new Date(event.commence_time),
          completed: false,
        });
        gamesUpdated++;
        
        // Process bookmakers
        for (const bookmaker of event.bookmakers || []) {
          await storage.upsertBookmaker({
            id: bookmaker.key,
            title: bookmaker.title,
            lastUpdate: new Date(bookmaker.last_update),
          });
          booksUpdated++;
          
          // Process markets
          for (const market of bookmaker.markets || []) {
            for (const outcome of market.outcomes || []) {
              let outcomeType = "";
              
              if (market.key === "h2h") {
                outcomeType = outcome.name === event.home_team ? "home" : "away";
              } else if (market.key === "spreads") {
                outcomeType = outcome.name === event.home_team ? "home" : "away";
              } else if (market.key === "totals") {
                outcomeType = outcome.name === "Over" ? "over" : "under";
              }
              
              if (outcomeType) {
                await storage.upsertOdds({
                  gameId: event.id,
                  bookmakerId: bookmaker.key,
                  market: market.key,
                  outcomeType,
                  price: String(outcome.price),
                  point: outcome.point ? String(outcome.point) : null,
                });
                oddsUpdated++;
              }
            }
          }
        }
      }
      
      res.json({
        success: true,
        message: `Synced ESPN NFL odds`,
        stats: {
          gamesUpdated,
          booksUpdated,
          oddsUpdated,
          source: "ESPN"
        }
      });
      
    } catch (error: any) {
      console.error('ESPN sync error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to sync ESPN odds"
      });
    }
  });

  // Compare ESPN vs SportsDataIO odds
  app.get("/api/odds/compare", async (req, res) => {
    try {
      const sport = (req.query.sport as string) || "NFL";
      
      console.log('📊 Comparing odds from multiple sources...');
      
      // Fetch from both sources
      const [espnData, sportsDataIoData] = await Promise.allSettled([
        getNflOddsToday(),
        sportsDataIoService.getOdds(sport, 25)
      ]);
      
      const comparison: any = {
        espn: {
          available: espnData.status === 'fulfilled',
          events: 0,
          quotes: 0,
          bookmakers: new Set<string>(),
          error: espnData.status === 'rejected' ? espnData.reason?.message : null
        },
        sportsDataIo: {
          available: sportsDataIoData.status === 'fulfilled',
          events: 0,
          quotes: 0,
          bookmakers: new Set<string>(),
          error: sportsDataIoData.status === 'rejected' ? sportsDataIoData.reason?.message : null
        }
      };
      
      // Process ESPN data
      if (espnData.status === 'fulfilled') {
        const data = espnData.value;
        comparison.espn.events = Object.keys(data).length;
        for (const event of Object.values(data)) {
          comparison.espn.quotes += event.quotes.length;
          event.quotes.forEach(q => comparison.espn.bookmakers.add(q.book));
        }
      }
      
      // Process SportsDataIO data
      if (sportsDataIoData.status === 'fulfilled') {
        const data = sportsDataIoData.value;
        comparison.sportsDataIo.events = data.length;
        for (const event of data) {
          for (const bookmaker of event.bookmakers || []) {
            comparison.sportsDataIo.bookmakers.add(bookmaker.title);
            for (const market of bookmaker.markets || []) {
              comparison.sportsDataIo.quotes += market.outcomes?.length || 0;
            }
          }
        }
      }
      
      // Convert Sets to arrays for JSON
      comparison.espn.bookmakers = Array.from(comparison.espn.bookmakers);
      comparison.sportsDataIo.bookmakers = Array.from(comparison.sportsDataIo.bookmakers);
      
      res.json({
        success: true,
        comparison,
        recommendation: comparison.espn.quotes > comparison.sportsDataIo.quotes ? 
          "ESPN has more odds data available" : 
          "SportsDataIO has more odds data available"
      });
      
    } catch (error: any) {
      console.error('Comparison error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to compare odds sources"
      });
    }
  });

  // Fallback endpoint: Use ESPN if SportsDataIO fails
  app.get("/api/odds/best", async (req, res) => {
    try {
      const sport = (req.query.sport as string) || "NFL";
      const preferEspn = req.query.prefer === 'espn';
      
      let data: any = null;
      let source = 'none';
      
      if (preferEspn) {
        // Try ESPN first
        try {
          const espnData = await getNflOddsToday();
          if (Object.keys(espnData).length > 0) {
            data = transformEspnToDbFormat(espnData, sport);
            source = 'ESPN';
          }
        } catch (e) {
          console.warn('ESPN failed, trying SportsDataIO...', e);
        }
        
        // Fallback to SportsDataIO
        if (!data) {
          try {
            data = await sportsDataIoService.getOdds(sport, 25);
            source = 'SportsDataIO';
          } catch (e) {
            console.warn('SportsDataIO also failed', e);
          }
        }
      } else {
        // Try SportsDataIO first
        try {
          data = await sportsDataIoService.getOdds(sport, 25);
          source = 'SportsDataIO';
        } catch (e) {
          console.warn('SportsDataIO failed, trying ESPN...', e);
        }
        
        // Fallback to ESPN
        if (!data || data.length === 0) {
          try {
            const espnData = await getNflOddsToday();
            if (Object.keys(espnData).length > 0) {
              data = transformEspnToDbFormat(espnData, sport);
              source = 'ESPN';
            }
          } catch (e) {
            console.warn('ESPN also failed', e);
          }
        }
      }
      
      if (!data) {
        return res.status(503).json({
          success: false,
          error: "No odds sources available",
          tried: ['SportsDataIO', 'ESPN']
        });
      }
      
      res.json({
        success: true,
        source,
        count: Array.isArray(data) ? data.length : Object.keys(data).length,
        data
      });
      
    } catch (error: any) {
      console.error('Best odds error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to fetch odds"
      });
    }
  });

  // Test all odds sources
  app.get("/api/odds/test-all", async (_req, res) => {
    try {
      console.log('🧪 Testing all odds sources...');
      
      const results: any = {
        espn: { working: false, error: null, sampleData: null },
        sportsDataIo: { working: false, error: null, sampleData: null },
        arbitrage: { working: false, error: null, sampleData: null }
      };
      
      // Test ESPN
      try {
        const espnData = await getNflOddsToday();
        const eventCount = Object.keys(espnData).length;
        results.espn.working = eventCount > 0;
        if (eventCount > 0) {
          const firstEvent = Object.values(espnData)[0];
          results.espn.sampleData = {
            events: eventCount,
            firstEvent: {
              teams: `${firstEvent.awayTeam} @ ${firstEvent.homeTeam}`,
              quotes: firstEvent.quotes.length,
              bestOdds: firstEvent.best
            }
          };
        }
      } catch (e: any) {
        results.espn.error = e.message;
      }
      
      // Test SportsDataIO
      try {
        const sdioData = await sportsDataIoService.getOdds("NFL", 1);
        results.sportsDataIo.working = sdioData.length > 0;
        if (sdioData.length > 0) {
          results.sportsDataIo.sampleData = {
            events: sdioData.length,
            firstEvent: {
              teams: `${sdioData[0].away_team} @ ${sdioData[0].home_team}`,
              bookmakers: sdioData[0].bookmakers?.length || 0
            }
          };
        }
      } catch (e: any) {
        results.sportsDataIo.error = e.message;
      }
      
      // Test Arbitrage API (if configured)
      if (process.env.RAPIDAPI_KEY) {
        try {
          const arbData = await arbitrageApiService.getArbitrage();
          results.arbitrage.working = true;
          results.arbitrage.sampleData = {
            type: "ARBITRAGE",
            hasData: !!arbData
          };
        } catch (e: any) {
          results.arbitrage.error = e.message;
        }
      } else {
        results.arbitrage.error = "RAPIDAPI_KEY not configured";
      }
      
      // Overall status
      const workingSources = Object.entries(results)
        .filter(([_, result]) => result.working)
        .map(([name]) => name);
      
      res.json({
        success: workingSources.length > 0,
        workingSources,
        totalSources: Object.keys(results).length,
        results,
        recommendation: workingSources.length === 0 ? 
          "No odds sources are working. Check API keys and network connectivity." :
          `Use ${workingSources[0]} as primary source`
      });
      
    } catch (error: any) {
      console.error('Test all error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to test odds sources"
      });
    }
  });

  // Unified odds endpoint with automatic fallback
  app.get("/api/odds/unified", async (req, res) => {
    try {
      const sport = (req.query.sport as string) || "NFL";
      const limit = parseInt(req.query.limit as string) || 25;
      const includeStats = req.query.stats === 'true';
      
      console.log(`📊 Fetching unified odds for ${sport}...`);
      
      const results = {
        sport,
        timestamp: new Date().toISOString(),
        sources: [] as any[],
        combined: [] as any[],
        stats: {
          totalEvents: 0,
          totalBookmakers: new Set<string>(),
          totalQuotes: 0,
          bySource: {} as Record<string, any>
        }
      };
      
      // Try all sources in parallel
      const [espnResult, sdioResult] = await Promise.allSettled([
        sport === "NFL" ? getNflOddsToday() : Promise.reject(new Error("ESPN only supports NFL")),
        sportsDataIoService.getOdds(sport, limit)
      ]);
      
      // Process ESPN results
      if (espnResult.status === 'fulfilled') {
        const espnData = espnResult.value;
        const formatted = transformEspnToDbFormat(espnData, sport);
        
        let espnQuotes = 0;
        const espnBooks = new Set<string>();
        
        formatted.forEach(event => {
          event.bookmakers?.forEach(bm => {
            espnBooks.add(bm.title);
            bm.markets?.forEach(m => {
              espnQuotes += m.outcomes?.length || 0;
            });
          });
        });
        
        results.sources.push({
          name: 'ESPN',
          status: 'success',
          events: formatted.length,
          bookmakers: espnBooks.size,
          quotes: espnQuotes
        });
        
        results.stats.bySource['ESPN'] = {
          events: formatted.length,
          bookmakers: Array.from(espnBooks),
          quotes: espnQuotes
        };
        
        // Add to combined results with source tag
        formatted.forEach(event => {
          results.combined.push({
            ...event,
            _source: 'ESPN'
          });
        });
      } else {
        results.sources.push({
          name: 'ESPN',
          status: 'failed',
          error: espnResult.reason?.message || 'Unknown error'
        });
      }
      
      // Process SportsDataIO results
      if (sdioResult.status === 'fulfilled') {
        const sdioData = sdioResult.value;
        
        let sdioQuotes = 0;
        const sdioBooks = new Set<string>();
        
        sdioData.forEach(event => {
          event.bookmakers?.forEach(bm => {
            sdioBooks.add(bm.title);
            bm.markets?.forEach(m => {
              sdioQuotes += m.outcomes?.length || 0;
            });
          });
        });
        
        results.sources.push({
          name: 'SportsDataIO',
          status: 'success',
          events: sdioData.length,
          bookmakers: sdioBooks.size,
          quotes: sdioQuotes
        });
        
        results.stats.bySource['SportsDataIO'] = {
          events: sdioData.length,
          bookmakers: Array.from(sdioBooks),
          quotes: sdioQuotes
        };
        
        // Add to combined results with source tag
        sdioData.forEach(event => {
          // Check if we already have this game from ESPN
          const existing = results.combined.find(e => 
            e.home_team === event.home_team && 
            e.away_team === event.away_team
          );
          
          if (existing && existing.bookmakers.length < (event.bookmakers?.length || 0)) {
            // Replace with SportsDataIO data if it has more bookmakers
            const index = results.combined.indexOf(existing);
            results.combined[index] = {
              ...event,
              _source: 'SportsDataIO'
            };
          } else if (!existing) {
            results.combined.push({
              ...event,
              _source: 'SportsDataIO'
            });
          }
        });
      } else {
        results.sources.push({
          name: 'SportsDataIO',
          status: 'failed',
          error: sdioResult.reason?.message || 'Unknown error'
        });
      }
      
      // Calculate combined stats
      results.stats.totalEvents = results.combined.length;
      results.combined.forEach(event => {
        event.bookmakers?.forEach(bm => {
          results.stats.totalBookmakers.add(bm.title);
          bm.markets?.forEach(m => {
            results.stats.totalQuotes += m.outcomes?.length || 0;
          });
        });
      });
      
      // Sort by commence time
      results.combined.sort((a, b) => 
        new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
      );
      
      // Apply limit
      results.combined = results.combined.slice(0, limit);
      
      // Convert Set to array for JSON
      results.stats.totalBookmakers = Array.from(results.stats.totalBookmakers) as any;
      
      res.json({
        success: results.combined.length > 0,
        ...results,
        summary: includeStats ? {
          message: `Found ${results.stats.totalEvents} events from ${results.sources.filter(s => s.status === 'success').length} sources`,
          bestSource: results.sources.find(s => s.status === 'success')?.name || 'none',
          coverage: {
            espn: results.stats.bySource['ESPN']?.events || 0,
            sportsDataIO: results.stats.bySource['SportsDataIO']?.events || 0
          }
        } : undefined
      });
      
    } catch (error: any) {
      console.error('Unified odds error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to fetch unified odds"
      });
    }
  });

  // Sync from best available source
  app.post("/api/odds/sync-best", async (req, res) => {
    try {
      const { sport = "NFL", limit = 10 } = req.body;
      
      console.log(`🔄 Syncing best available odds for ${sport}...`);
      
      let source = 'none';
      let data: any[] = [];
      
      // Try SportsDataIO first (usually more reliable)
      try {
        data = await sportsDataIoService.getOdds(sport, limit);
        source = 'SportsDataIO';
      } catch (e) {
        console.warn('SportsDataIO failed:', e);
      }
      
      // Fallback to ESPN if needed and sport is NFL
      if ((!data || data.length === 0) && sport === "NFL") {
        try {
          const espnData = await getNflOddsToday();
          data = transformEspnToDbFormat(espnData, sport);
          source = 'ESPN';
        } catch (e) {
          console.warn('ESPN also failed:', e);
        }
      }
      
      if (!data || data.length === 0) {
        return res.status(503).json({
          success: false,
          error: "No odds sources available",
          attempted: ['SportsDataIO', sport === 'NFL' ? 'ESPN' : null].filter(Boolean)
        });
      }
      
      // Sync to database
      let gamesUpdated = 0;
      let oddsUpdated = 0;
      let booksUpdated = 0;
      
      for (const event of data.slice(0, limit)) {
        if (!event.home_team || !event.away_team) continue;
        
        try {
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
          gamesUpdated++;
          
          for (const bookmaker of event.bookmakers || []) {
            await storage.upsertBookmaker({
              id: bookmaker.key,
              title: bookmaker.title,
              lastUpdate: new Date(bookmaker.last_update || Date.now()),
            });
            booksUpdated++;
            
            for (const market of bookmaker.markets || []) {
              for (const outcome of market.outcomes || []) {
                let outcomeType = "";
                
                if (market.key === "h2h") {
                  outcomeType = outcome.name === event.home_team ? "home" : "away";
                } else if (market.key === "spreads") {
                  outcomeType = outcome.name === event.home_team ? "home" : "away";
                } else if (market.key === "totals") {
                  outcomeType = outcome.name?.toLowerCase() === "over" ? "over" : "under";
                }
                
                if (outcomeType) {
                  await storage.upsertOdds({
                    gameId: event.id,
                    bookmakerId: bookmaker.key,
                    market: market.key,
                    outcomeType,
                    price: String(outcome.price),
                    point: outcome.point ? String(outcome.point) : null,
                  });
                  oddsUpdated++;
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error syncing event ${event.id}:`, err);
        }
      }
      
      res.json({
        success: true,
        message: `Synced from ${source}`,
        source,
        sport,
        stats: {
          gamesUpdated,
          booksUpdated,
          oddsUpdated
        }
      });
      
    } catch (error: any) {
      console.error('Sync best error:', error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to sync odds"
      });
    }
  });

  // =========================
  // Admin: run Drizzle migrations on Neon
  // =========================
  app.post("/api/_admin/migrate", async (_req, res) => {
    try {
      await migrate(db, { migrationsFolder: "migrations" });
      res.json({ ok: true, ran: true });
    } catch (err: any) {
      console.error("Migration failed:", err);
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  });

  return app;
}
