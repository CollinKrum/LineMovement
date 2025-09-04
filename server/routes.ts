import type { Express } from "express";
import { storage } from "./storage";
import { oddsApiService } from "./services/oddsApi";
import { insertUserFavoriteSchema, insertUserAlertSchema } from "@shared/schema";

/**
 * Register API routes on the provided Express app.
 * Returns the same app (so index.ts can call app.listen()).
 */
export function registerRoutes(app: Express): Express {
  // --- Health (also in index.ts, but handy here if you prefer) ---
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // --- Sports ---
  app.get("/api/sports", async (_req, res) => {
    try {
      const sports = await storage.getSports();
      res.json(sports);
    } catch (error) {
      console.error("Error fetching sports:", error);
      res.status(500).json({ message: "Failed to fetch sports" });
    }
  });

  // Sync sports (from Odds API / SportsGameOdds)
  app.post("/api/sports/sync", async (_req, res) => {
    try {
      const sportsData = await oddsApiService.getSports();
      const majorSports = ["NFL", "NBA", "MLB", "NHL", "NCAAF", "NCAAB"];
      const filtered = sportsData.filter((s: any) => majorSports.includes(s.key));

      for (const sport of filtered) {
        await storage.upsertSport({
          id: sport.key,
          title: sport.title,
          description: sport.description,
          active: sport.active,
          hasOutrights: sport.has_outrights,
        });
      }
      res.json({ message: `Synced ${filtered.length} sports` });
    } catch (error) {
      console.error("Error syncing sports:", error);
      res.status(500).json({ message: "Failed to sync sports" });
    }
  });

  // --- Games ---
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

  // --- Line movements: big movers ---
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

  // --- Odds sync (per sport) ---
  app.post("/api/odds/sync", async (req, res) => {
    try {
      const { sport } = req.body as { sport?: string };
      if (!sport) return res.status(400).json({ message: "Sport parameter is required" });

      const oddsData = await oddsApiService.getOdds(sport);
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

        for (const bookmaker of event.bookmakers) {
          const lastUpdate = bookmaker.last_update ? new Date(bookmaker.last_update) : new Date();
          if (isNaN(lastUpdate.getTime())) continue;

          await storage.upsertBookmaker({
            id: bookmaker.key,
            title: bookmaker.title,
            lastUpdate,
          });

          for (const market of bookmaker.markets) {
            for (const outcome of market.outcomes) {
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
                  point: outcome.point != null ? String(outcome.point) : null,
                });
                oddsUpdated++;
              }
            }
          }
        }
      }

      res.json({ message: `Synced ${gamesUpdated} games and ${oddsUpdated} odds entries`, gamesUpdated, oddsUpdated });
    } catch (error) {
      console.error("Error syncing odds:", error);
      res.status(500).json({ message: "Failed to sync odds" });
    }
  });

  // --- Odds by game ---
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

  // --- Best odds per market ---
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

  // --- Line movement history ---
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

  // --- (Temporarily disable auth-protected routes) ---
  // You can re-enable these once auth is wired in a later step.
  app.get("/api/favorites", async (_req, res) => {
    res.status(501).json({ message: "Favorites not enabled yet" });
  });
  app.post("/api/favorites/toggle", async (_req, res) => {
    res.status(501).json({ message: "Favorites not enabled yet" });
  });
  app.get("/api/alerts", async (_req, res) => {
    res.status(501).json({ message: "Alerts not enabled yet" });
  });
  app.post("/api/alerts", async (_req, res) => {
    res.status(501).json({ message: "Alerts not enabled yet" });
  });
  app.delete("/api/alerts/:alertId", async (_req, res) => {
    res.status(501).json({ message: "Alerts not enabled yet" });
  });

  // --- API usage (optional) ---
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
