import type { Express } from "express";
import { storage } from "./storage.js";
import { oddsApiService } from "./services/oddsApi.js";            // SportsGameOdds (primary)
import { arbitrageApiService } from "./services/arbitrageApi.js";  // RapidAPI sportsbook-api2 (fallback/read)
import { db } from "./db.js";
import { sql } from "drizzle-orm";

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

  // --- Debug odds config (env flags + local sport keys) ---
  app.get("/api/_debug/odds-config", async (_req, res) => {
    try {
      const hasSGO = Boolean(process.env.SPORTSGAMEODDS_API_KEY);
      const hasRapid = Boolean(process.env.RAPIDAPI_KEY);
      const sports = await storage.getSports().catch(() => []);
      const keys = Array.isArray(sports)
        ? sports.map((s: any) => s.id ?? s.key ?? s.leagueID ?? s.sportID).filter(Boolean)
        : [];

      res.json({
        ok: true,
        env: {
          SPORTSGAMEODDS_API_KEY_set: hasSGO,
          RAPIDAPI_KEY_set: hasRapid,
        },
        knownSportKeys: keys.slice(0, 50),
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  });

  // --- Quick sample pull from SGO (helps debug keys/network) ---
  app.get("/api/_debug/sgo-events", async (req, res) => {
    try {
      const sport = (req.query.sport as string) || "NFL";
      const events = await oddsApiService.getOdds(sport, 5, 1); // (sport, limit, maxPages)
      res.json({ ok: true, sport, count: events.length, sample: events.slice(0, 2) });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: String(error?.message || error),
        status: error?.status ?? null,
        body: error?.body ?? null,
      });
    }
  });

  // =========================
  // Sports (SGO)
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
      const leagues = await oddsApiService.getSports(); // from SGO
      for (const league of leagues) {
        await storage.upsertSport({
          id: league.key,           // e.g. "NFL"
          title: league.title,      // e.g. "NFL"
          description: league.description,
          active: league.active,
          hasOutrights: league.has_outrights,
        });
      }
      res.json({ message: `Synced ${leagues.length} sports` });
    } catch (error) {
      console.error("Error syncing sports:", error);
      res.status(500).json({ message: "Failed to sync sports" });
    }
  });

  // =========================
  // Games & Odds (SGO primary; RapidAPI fallback)
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

  // Pull odds from SGO and upsert into DB (supports limit & maxPages via query params)
  // Falls back to RapidAPI arbitrage read-through on SGO 429
  // NEW: ?forceFallback=1 to always use RapidAPI (no DB writes)
  app.post("/api/odds/sync", async (req, res) => {
    try {
      const { sport } = req.body as { sport?: string };
      if (!sport) return res.status(400).json({ message: "Sport parameter is required" });

      const limit = Math.max(1, parseInt(String(req.query.limit ?? "25"), 10));       // default 25 per page
      const maxPages = Math.max(1, parseInt(String(req.query.maxPages ?? "1"), 10));  // default 1 page
      const forceFallback = String(req.query.forceFallback ?? "0") === "1";

      let oddsData: any[] = [];
      try {
        if (forceFallback) {
          const arbType = (req.query.fallbackType as string) || "ARBITRAGE";
          const arb = await arbitrageApiService.getArbitrage(arbType);
          return res.json({
            message: "Forced RapidAPI arbitrage fallback (no DB writes).",
            fallbackUsed: "rapidapi-arbitrage",
            sport,
            limit,
            maxPages,
            arbitrageCount: Array.isArray(arb?.advantages) ? arb.advantages.length : 0,
            arbitrageSample: Array.isArray(arb?.advantages) ? arb.advantages.slice(0, 2) : arb
          });
        }

        // Normal path: try SGO first
        oddsData = await oddsApiService.getOdds(sport, limit, maxPages);
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status ?? null;
        if (status === 429) {
          // RapidAPI fallback (no DB writes; just returns data so you can see something)
          try {
            const arbType = (req.query.fallbackType as string) || "ARBITRAGE";
            const arb = await arbitrageApiService.getArbitrage(arbType);
            return res.json({
              message: "SGO rate-limited (429). Returned RapidAPI arbitrage as fallback (no DB writes).",
              fallbackUsed: "rapidapi-arbitrage",
              sport,
              limit,
              maxPages,
              arbitrageCount: Array.isArray(arb?.advantages) ? arb.advantages.length : 0,
              arbitrageSample: Array.isArray(arb?.advantages) ? arb.advantages.slice(0, 2) : arb
            });
          } catch (fallbackErr: any) {
            return res.status(502).json({
              message: "SGO rate-limited and RapidAPI fallback also failed",
              providerStatus: status,
              providerError: String(err?.body || err?.message || err),
              fallbackError: String(fallbackErr?.message || fallbackErr)
            });
          }
        }
        // Not a 429 → rethrow to outer catch
        throw err;
      }

      // If we got here, SGO returned data → proceed with DB writes
      let gamesUpdated = 0;
      let oddsUpdated = 0;

      for (const event of oddsData) {
        const commenceTime = event.commence_time ? new Date(event.commence_time) : new Date();
        if (isNaN(commenceTime.getTime())) continue;

        await storage.upsertGame({
          id: event.id,
          sportId: event.sport_key,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          commenceTime,
          completed: false,
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
              oddsUpdated++;
            }
          }
        }
      }

      res.json({
        message: `Synced ${gamesUpdated} games and ${oddsUpdated} odds entries`,
        sport,
        limit,
        maxPages,
        gamesUpdated,
        oddsUpdated,
        fallbackUsed: null
      });
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status ?? null;
      const body = error?.body ?? error?.response?.data ?? null;
      console.error("Error syncing odds:", status, body || error);
      res.status(500).json({
        message: "Failed to sync odds",
        providerStatus: status,
        providerError:
          typeof body === "string"
            ? body.slice(0, 500)
            : (body?.message ?? String(error?.message || error)).slice(0, 500),
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
  // Arbitrage (RapidAPI sportsbook-api2)
  // =========================
  app.get("/api/arbitrage", async (req, res) => {
    try {
      const type = (req.query.type as string) || "ARBITRAGE";
      const data = await arbitrageApiService.getArbitrage(type);
      res.json(data);
    } catch (err: any) {
      console.error("Failed to fetch arbitrage:", err);
      res.status(500).json({ message: "Failed to fetch arbitrage", error: String(err?.message || err) });
    }
  });

  // --- Seed DB from RapidAPI arbitrage (temporary helper) ---
  app.post("/api/arbitrage/seed-db", async (req, res) => {
    try {
      const type = (req.query.type as string) || "ARBITRAGE";
      const limit = Math.max(1, parseInt(String(req.query.limit ?? "10"), 10));

      // pull arbitrage snapshot
      const data = await arbitrageApiService.getArbitrage(type);
      const list: any[] = Array.isArray(data?.advantages) ? data.advantages.slice(0, limit) : [];

      let gamesUpserted = 0;
      let oddsUpserted = 0;
      let booksUpserted = 0;

      for (const adv of list) {
        const ev = adv?.market?.event;
        if (!ev?.key) continue;

        // synthesize IDs/fields to match our schema
        const gameId = String(ev.key);
        const sportId =
          ev?.competitionInstance?.competition?.shortName ||
          ev?.participants?.[0]?.sport ||
          "GENERIC";
        const homeTeam = (ev?.participants || []).find((p: any) => p.key === ev.homeParticipantKey)?.name
          || ev?.participants?.[0]?.name
          || "Home";
        const awayTeam = (ev?.participants || []).find((p: any) => p.key !== ev.homeParticipantKey)?.name
          || ev?.participants?.[1]?.name
          || "Away";
        const commenceTime = ev.startTime ? new Date(ev.startTime) : new Date();

        // upsert game
        await storage.upsertGame({
          id: gameId,
          sportId,
          homeTeam,
          awayTeam,
          commenceTime,
          completed: false,
          homeScore: null,
          awayScore: null,
          updatedAt: new Date(),
        });
        gamesUpserted++;

        // outcomes contain per-book edges we can treat like “bookmaker quotes”
        for (const out of adv?.outcomes || []) {
          const bookmakerKey = String(out.source || "UNKNOWN");
          const bookmakerTitle = String(out.source || "Unknown Book");

          // upsert bookmaker
          await storage.upsertBookmaker({
            id: bookmakerKey,
            title: bookmakerTitle,
            lastUpdate: new Date(out.lastFoundAt || out.readAt || new Date()),
          });
          booksUpserted++;

          // map arbitrage outcome to a market+outcome
          const marketKey = (adv?.market?.type || "H2H").toLowerCase(); // e.g., BOTH_TEAMS_TO_SCORE
          const outcomeType = (() => {
            // try to map YES/NO → over/under, else home/away buckets
            const t = String(out.type || "").toLowerCase();
            if (t === "yes" || t === "over") return "over";
            if (t === "no" || t === "under") return "under";
            // fallback to “home/away” split by participantKey if present
            if (out.participantKey && out.participantKey === ev.homeParticipantKey) return "home";
            if (out.participantKey && out.participantKey !== ev.homeParticipantKey) return "away";
            return "home";
          })();

          // RapidAPI gives payout (decimal) rather than American odds — store as string
          await storage.upsertOdds({
            gameId,
            bookmakerId: bookmakerKey,
            market: marketKey,
            outcomeType,
            price: String(out.payout), // decimal odds
            point: null,
          });
          oddsUpserted++;
        }
      }

      return res.json({
        ok: true,
        type,
        seededFrom: "rapidapi-arbitrage",
        count: list.length,
        gamesUpserted,
        booksUpserted,
        oddsUpserted,
      });
    } catch (err: any) {
      console.error("Seed from RapidAPI failed:", err);
      return res.status(500).json({ ok: false, message: "Seed from RapidAPI failed", error: String(err?.message || err) });
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

  // Usage (optional passthrough)
  app.get("/api/usage", async (_req, res) => {
    try {
      const usage = await oddsApiService.getApiUsage();
      res.json(usage);
    } catch (error) {
      console.error("Error fetching API usage:", error);
      res.status(500).json({ message: "Failed to fetch API usage" });
    }
  });

  return app;
}
