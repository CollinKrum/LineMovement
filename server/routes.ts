import type { Express } from "express";
import { storage } from "./storage.js";
import { sportsDataIoService } from "./services/sportsDataIoApi.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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

      let gamesUpdated = 0;
      let oddsUpdated = 0;

      try {
        const oddsData = await sportsDataIoService.getOdds(sport, limit);

        for (const event of oddsData) {
          const commenceTime = event.commence_time ? new Date(event.commence_time) : new Date();
          if (isNaN(commenceTime.getTime())) continue;

          await storage.upsertGame({
            id: event.id,
            sportId: event.sport_key,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            commenceTime,
            completed: event.completed || false,
            homeScore: event.home_score,
            awayScore: event.away_score,
          });
          gamesUpdated++;

          for (const bookmaker of event.bookmakers || []) {
            const lastUpdate = bookmaker.last_update ? new Date(bookmaker.last_update) : new Date();
            if (isNaN(lastUpdate.getTime())) continue;

            await storage.upsertBookmaker({
              id: bookmaker.key,
              title: bookmaker.title,
              lastUpdate,
            });

    for (const market of bookmaker.markets || []) {
    for (const outcome of market.outcomes || []) {
    let outcomeType = "";

    if (market.key === "h2h" || market.key === "spreads") {
      const n = String(outcome.name || "").toLowerCase();
      if (n === "home" || outcome.name === event.home_team) outcomeType = "home";
      else if (n === "away" || outcome.name === event.away_team) outcomeType = "away";
    } else if (market.key === "totals") {
      const n = String(outcome.name || "").toLowerCase();
      outcomeType = n === "over" ? "over" : n === "under" ? "under" : "";
    }

    if (!outcomeType) continue;

    await storage.upsertOdds({
      gameId: event.id,
      bookmakerId: bookmaker.key,
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

        res.json({
          message: `Synced ${gamesUpdated} games and ${oddsUpdated} odds entries`,
          sport,
          limit,
          gamesUpdated,
          oddsUpdated,
          provider: "SportsDataIO"
        });
      } catch (error: any) {
        const status = error?.status ?? error?.response?.status ?? null;
        const body = error?.body ?? error?.response?.data ?? null;
        console.error("Error syncing odds:", status, body || error);
        res.status(500).json({
          message: "Failed to sync odds",
          providerStatus: status,
          provider: "SportsDataIO",
          providerError:
            typeof body === "string"
              ? body.slice(0, 500)
              : (body?.message ?? String(error?.message || error)).slice(0, 500),
        });
      }
    } catch (error: any) {
      console.error("Error in odds sync:", error);
      res.status(500).json({
        message: "Failed to sync odds",
        provider: "SportsDataIO",
        error: String(error?.message || error)
      });
    }
  });

  // Odds for a specific game
  app.get("/api/games/:gameId/odds", async (req, res) => {
    try {
      const { gameId } = req.params as { gameId: string };
      const odds = await storage.getOddsByGame(gameId);
      res.json(odds);
    } catch (error) {
      console.error("Error fetching game odds:", error);
      res.status(500).json({ message: "Failed to fetch game odds" });
    }
  });

  // Best odds per market
  app.get("/api/games/:gameId/best-odds", async (req, res) => {
    try {
      const { gameId } = req.params as { gameId: string };
      const market = req.query.market as string | undefined;
    if (!market) return res.status(400).json({ message: "Market parameter is required" });

      const bestOdds = await storage.getBestOdds(gameId, market);
      res.json(bestOdds);
    } catch (error) {
      console.error("Error fetching best odds:", error);
      res.status(500).json({ message: "Failed to fetch best odds" });
    }
  });

  // Line movement history
  app.get("/api/games/:gameId/movements", async (req, res) => {
    try {
      const { gameId } = req.params as { gameId: string };
      const hours = parseInt((req.query.hours as string) ?? "24", 10);
      const movements = await storage.getLineMovements(gameId, hours);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching line movements:", error);
      res.status(500).json({ message: "Failed to fetch line movements" });
    }
  });

  // Alias for big movers
  app.get("/api/line-movements/big-movers", async (req, res) => {
    try {
      const hours = parseInt((req.query.hours as string) ?? "24", 10);
      const minMovement = parseFloat((req.query.minMovement as string) ?? "1.0");
      const bigMovers = await storage.getBigMovers(hours, minMovement);
      res.json(bigMovers);
    } catch (error) {
      console.error("Error fetching big movers:", error);
      res.status(500).json({ message: "Failed to fetch big movers" });
    }
  });

  // =========================
  // Additional SportsDataIO Features
  // =========================

  // Player stats
  app.get("/api/players/:sport", async (req, res) => {
    try {
      const { sport } = req.params;
      const season = req.query.season as string;
      const players = await sportsDataIoService.getPlayerStats(sport, season);
      res.json({
        sport,
        season: season || "current",
        players,
        provider: "SportsDataIO"
      });
    } catch (error) {
      console.error("Error fetching player stats:", error);
      res.status(500).json({ message: "Failed to fetch player stats" });
    }
  });

  // Team standings
  app.get("/api/standings/:sport", async (req, res) => {
    try {
      const { sport } = req.params;
      const standings = await sportsDataIoService.getStandings(sport);
      res.json({
        sport,
        standings,
        provider: "SportsDataIO"
      });
    } catch (error) {
      console.error("Error fetching standings:", error);
      res.status(500).json({ message: "Failed to fetch standings" });
    }
  });

  // --- Best odds summary (returns the single best HOME and AWAY price) ---
  app.get("/api/games/:gameId/best-odds/summary", async (req, res) => {
    try {
      const { gameId } = req.params as { gameId: string };
      const market = (req.query.market as string) || "spreads";

      // Pull all odds for this game & market
      const all = await storage.getOddsByGame(gameId);

      // Filter to target market only
      const rows = all.filter((r: any) => r.market === market);

      // Reduce to best per outcome
      const best = rows.reduce(
        (acc: any, row: any) => {
          const side = row.outcomeType; // 'home' | 'away' | 'over' | 'under'
          const priceNum = Number(row.price);
          if (!Number.isFinite(priceNum)) return acc;

          if (!acc[side] || priceNum > Number(acc[side].price)) {
            acc[side] = {
              gameId: row.gameId,
              market: row.market,
              outcomeType: row.outcomeType,
              price: row.price,
              point: row.point,
              bookmakerId: row.bookmakerId,
              bookmakerTitle: row.bookmakerTitle ?? row.bookmakerId,
              lastUpdate: row.lastUpdate ?? null,
            };
          }
          return acc;
        },
        {} as Record<string, any>
      );

      res.json({
        gameId,
        market,
        bestHome: best.home ?? null,
        bestAway: best.away ?? null,
        bestOver: best.over ?? null,
        bestUnder: best.under ?? null,
      });
    } catch (error) {
      console.error("Error fetching best-odds summary:", error);
      res.status(500).json({ message: "Failed to fetch best-odds summary" });
    }
  });

  // --- Upcoming games with best-odds summary (UI-friendly feed) ---
  app.get("/api/games/with-best", async (req, res) => {
    try {
      const market = (req.query.market as string) || "spreads";
      const limit = Math.min(parseInt((req.query.limit as string) ?? "25", 10) || 25, 100);

      // 1) get upcoming games
      const games = await storage.getUpcomingGames();

      // 2) compute best odds per game for requested market
      const rows: any[] = [];
      for (const g of games.slice(0, limit)) {
        const all = await storage.getOddsByGame(g.id);
        const mktRows = all.filter((r: any) => r.market === market);

        const best = mktRows.reduce(
          (acc: any, row: any) => {
            const side = row.outcomeType; // home | away | over | under
            const priceNum = Number(row.price);
            if (!Number.isFinite(priceNum)) return acc;
            if (!acc[side] || priceNum > Number(acc[side].price)) {
              acc[side] = {
                price: row.price,
                point: row.point,
                bookmakerId: row.bookmakerId,
                bookmakerTitle: row.bookmakerTitle ?? row.bookmakerId,
                lastUpdate: row.lastUpdate ?? null,
              };
            }
            return acc;
          },
          {} as Record<string, any>
        );

        rows.push({
          id: g.id,
          sportId: g.sportId,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          commenceTime: g.commenceTime,
          market,
          bestHome: best.home ?? null,
          bestAway: best.away ?? null,
          bestOver: best.over ?? null,
          bestUnder: best.under ?? null,
        });
      }

      res.json({ count: rows.length, games: rows });
    } catch (err) {
      console.error("Error in /api/games/with-best:", err);
      res.status(500).json({ message: "Failed to build games + best odds feed" });
    }
  });

  // =========================
  // Placeholders for auth features (disabled)
  // =========================
  app.get("/api/favorites", async (_req, res) => res.status(501).json({ message: "Favorites not enabled yet" }));
  app.post("/api/favorites/toggle", async (_req, res) => res.status(501).json({ message: "Favorites not enabled yet" }));
  app.get("/api/alerts", async (_req, res) => res.status(501).json({ message: "Alerts not enabled yet" }));
  app.post("/api/alerts", async (_req, res) => res.status(501).json({ message: "Alerts not enabled yet" }));
  app.delete("/api/alerts/:alertId", async (_req, res) => res.status(501).json({ message: "Alerts not enabled yet" }));

  // Usage (SportsDataIO)
  app.get("/api/usage", async (_req, res) => {
    try {
      const usage = await sportsDataIoService.getApiUsage();
      res.json(usage);
    } catch (error) {
      console.error("Error fetching API usage:", error);
      res.status(500).json({ message: "Failed to fetch API usage" });
    }
  });

  // =========================
  // Seed functionality for SportsDataIO
  // =========================
  app.post("/seed/sportsdata", async (req, res) => {
    try {
      const limit = Math.max(1, parseInt(String(req.query.limit ?? "10"), 10));
      const sport = (req.query.sport as string) || "NFL";

      const games = await sportsDataIoService.getGames(sport);
      const oddsData = await sportsDataIoService.getOdds(sport, limit);

      let gamesUpserted = 0;
      let oddsUpserted = 0;
      let booksUpserted = 0;

      // First sync sports
      const sports = await sportsDataIoService.getSports();
      for (const sportData of sports) {
        await storage.upsertSport({
          id: sportData.key,
          title: sportData.title,
          description: sportData.description,
          active: sportData.active,
          hasOutrights: sportData.has_outrights,
        });
      }

      // Then sync games and odds
      for (const event of oddsData.slice(0, limit)) {
        const commenceTime = event.commence_time ? new Date(event.commence_time) : new Date();
        if (isNaN(commenceTime.getTime())) continue;

        await storage.upsertGame({
          id: event.id,
          sportId: event.sport_key,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          commenceTime,
          completed: event.completed || false,
          homeScore: event.home_score,
          awayScore: event.away_score,
        });
        gamesUpserted++;

        for (const bookmaker of event.bookmakers || []) {
          const lastUpdate = bookmaker.last_update ? new Date(bookmaker.last_update) : new Date();
          if (isNaN(lastUpdate.getTime())) continue;

          await storage.upsertBookmaker({
            id: bookmaker.key,
            title: bookmaker.title,
            lastUpdate,
          });
          booksUpserted++;

          for (const market of bookmaker.markets || []) {
            for (const outcome of market.outcomes || []) {
              let outcomeType = "";
              if (market.key === "h2h" || market.key === "spreads") {
                outcomeType = outcome.name === event.home_team ? "home" : "away";
              } else if (market.key === "totals") {
                outcomeType = outcome.name?.toLowerCase() === "over" ? "over" : "under";
              }
              if (!outcomeType) continue;

              await storage.upsertOdds({
                gameId: event.id,
                bookmakerId: bookmaker.key,
                market: market.key,
                outcomeType,
                price: String(outcome.price),
                point: outcome.point != null ? String(outcome.point) : null,
              });
              oddsUpserted++;
            }
          }
        }
      }

      return res.json({
        ok: true,
        sport,
        seededFrom: "SportsDataIO",
        count: limit,
        gamesUpserted,
        booksUpserted,
        oddsUpserted,
      });
    } catch (err: any) {
      console.error("Seed from SportsDataIO failed:", err);
      return res.status(500).json({
        ok: false,
        message: "Seed from SportsDataIO failed",
        error: String(err?.message || err)
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
