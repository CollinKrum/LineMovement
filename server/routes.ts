import type { Express } from "express";
import { storage } from "./storage.js";
import { sportsDataIoService } from "./services/sportsDataIoApi.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getNflOddsToday } from "./services/espnOdds.js"; // <-- NEW

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
      const data = await getNflOddsToday();
      // Shape: { [eventId]: { quotes: OddsQuote[], best: Record<string, OddsQuote|null> } }
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Failed to fetch ESPN odds" });
    }
  });

  // =========================
  // Seed functionality for SportsDataIO (also fixed)
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
                const n = String(outcome.name || "").toLowerCase();
                const homeTeam = String(event.home_team || "").toLowerCase();
                const awayTeam = String(event.away_team || "").toLowerCase();

                if (n.includes("home") || n === homeTeam) {
                  outcomeType = "home";
                } else if (n.includes("away") || n === awayTeam) {
                  outcomeType = "away";
                }
              } else if (market.key === "totals") {
                const n = String(outcome.name || "").toLowerCase();
                if (n === "over") outcomeType = "over";
                if (n === "under") outcomeType = "under";
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
      return res.status(500).json({ ok: false, message: "Seed from SportsDataIO failed" });
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
