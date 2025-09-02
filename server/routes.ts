import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { oddsApiService } from "./services/oddsApi";
import { insertUserFavoriteSchema, insertUserAlertSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Sports routes
  app.get('/api/sports', async (req, res) => {
    try {
      const sports = await storage.getSports();
      res.json(sports);
    } catch (error) {
      console.error("Error fetching sports:", error);
      res.status(500).json({ message: "Failed to fetch sports" });
    }
  });

  // Sync sports from The Odds API
  app.post('/api/sports/sync', async (req, res) => {
    try {
      const sportsData = await oddsApiService.getSports();
      
      // Filter for major sports we want to track (SportsGameOdds format)
      const majorSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];
      const filteredSports = sportsData.filter(sport => majorSports.includes(sport.key));
      
      for (const sport of filteredSports) {
        await storage.upsertSport({
          id: sport.key,
          title: sport.title,
          description: sport.description,
          active: sport.active,
          hasOutrights: sport.has_outrights,
        });
      }
      
      res.json({ message: `Synced ${filteredSports.length} sports` });
    } catch (error) {
      console.error("Error syncing sports:", error);
      res.status(500).json({ message: "Failed to sync sports" });
    }
  });

  // Games routes
  app.get('/api/games', async (req, res) => {
    try {
      const { sport } = req.query;
      let games;
      
      if (sport && typeof sport === 'string') {
        games = await storage.getGamesBySport(sport);
      } else {
        games = await storage.getUpcomingGames();
      }
      
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  // Sync odds from The Odds API
  app.post('/api/odds/sync', async (req, res) => {
    try {
      const { sport } = req.body;
      
      if (!sport) {
        return res.status(400).json({ message: "Sport parameter is required" });
      }
      
      const oddsData = await oddsApiService.getOdds(sport);
      let gamesUpdated = 0;
      let oddsUpdated = 0;
      
      for (const event of oddsData) {
        // Parse commence time safely
        const commenceTime = event.commence_time ? new Date(event.commence_time) : new Date();
        if (isNaN(commenceTime.getTime())) {
          console.warn(`Invalid commence time for event ${event.id}:`, event.commence_time);
          continue;
        }
        
        // Upsert game
        await storage.upsertGame({
          id: event.id,
          sportId: event.sport_key,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          commenceTime,
          completed: false,
        });
        gamesUpdated++;
        
        // Upsert bookmakers and odds
        for (const bookmaker of event.bookmakers) {
          const lastUpdate = bookmaker.last_update ? new Date(bookmaker.last_update) : new Date();
          if (isNaN(lastUpdate.getTime())) {
            console.warn(`Invalid last_update for bookmaker ${bookmaker.key}:`, bookmaker.last_update);
            continue;
          }
          
          await storage.upsertBookmaker({
            id: bookmaker.key,
            title: bookmaker.title,
            lastUpdate,
          });
          
          // Process each market
          for (const market of bookmaker.markets) {
            for (const outcome of market.outcomes) {
              let outcomeType = '';
              
              if (market.key === 'h2h') {
                outcomeType = outcome.name === event.home_team ? 'home' : 'away';
              } else if (market.key === 'spreads') {
                outcomeType = outcome.name === event.home_team ? 'home' : 'away';
              } else if (market.key === 'totals') {
                outcomeType = outcome.name === 'Over' ? 'over' : 'under';
              }
              
              if (outcomeType) {
                await storage.upsertOdds({
                  gameId: event.id,
                  bookmakerId: bookmaker.key,
                  market: market.key,
                  outcomeType,
                  price: outcome.price.toString(),
                  point: outcome.point?.toString() || null,
                });
                oddsUpdated++;
              }
            }
          }
        }
      }
      
      res.json({ 
        message: `Synced ${gamesUpdated} games and ${oddsUpdated} odds entries`,
        gamesUpdated,
        oddsUpdated
      });
    } catch (error) {
      console.error("Error syncing odds:", error);
      res.status(500).json({ message: "Failed to sync odds" });
    }
  });

  // Get odds for a specific game
  app.get('/api/games/:gameId/odds', async (req, res) => {
    try {
      const { gameId } = req.params;
      const odds = await storage.getOddsByGame(gameId);
      res.json(odds);
    } catch (error) {
      console.error("Error fetching game odds:", error);
      res.status(500).json({ message: "Failed to fetch game odds" });
    }
  });

  // Get best odds for a game and market
  app.get('/api/games/:gameId/best-odds', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { market } = req.query;
      
      if (!market || typeof market !== 'string') {
        return res.status(400).json({ message: "Market parameter is required" });
      }
      
      const bestOdds = await storage.getBestOdds(gameId, market);
      res.json(bestOdds);
    } catch (error) {
      console.error("Error fetching best odds:", error);
      res.status(500).json({ message: "Failed to fetch best odds" });
    }
  });

  // Line movements
  app.get('/api/games/:gameId/movements', async (req, res) => {
    try {
      const { gameId } = req.params;
      const { hours } = req.query;
      
      const hoursNum = hours && typeof hours === 'string' ? parseInt(hours) : 24;
      const movements = await storage.getLineMovements(gameId, hoursNum);
      res.json(movements);
    } catch (error) {
      console.error("Error fetching line movements:", error);
      res.status(500).json({ message: "Failed to fetch line movements" });
    }
  });

  // Big movers
  app.get('/api/big-movers', async (req, res) => {
    try {
      const { hours, minMovement } = req.query;
      
      const hoursNum = hours && typeof hours === 'string' ? parseInt(hours) : 2;
      const minMoveNum = minMovement && typeof minMovement === 'string' ? parseFloat(minMovement) : 1;
      
      const bigMovers = await storage.getBigMovers(hoursNum, minMoveNum);
      res.json(bigMovers);
    } catch (error) {
      console.error("Error fetching big movers:", error);
      res.status(500).json({ message: "Failed to fetch big movers" });
    }
  });

  // User favorites (protected routes)
  app.get('/api/favorites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching user favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post('/api/favorites/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertUserFavoriteSchema.safeParse({ ...req.body, userId });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      
      const toggleResult = await storage.toggleUserFavorite(result.data);
      res.json(toggleResult);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to toggle favorite" });
    }
  });

  // User alerts (protected routes)
  app.get('/api/alerts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const alerts = await storage.getUserAlerts(userId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching user alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post('/api/alerts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertUserAlertSchema.safeParse({ ...req.body, userId });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      
      const alert = await storage.createUserAlert(result.data);
      res.json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(500).json({ message: "Failed to create alert" });
    }
  });

  app.delete('/api/alerts/:alertId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { alertId } = req.params;
      
      const deleted = await storage.deleteUserAlert(alertId, userId);
      if (deleted) {
        res.json({ message: "Alert deleted successfully" });
      } else {
        res.status(404).json({ message: "Alert not found" });
      }
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // API usage stats
  app.get('/api/usage', async (req, res) => {
    try {
      const usage = await oddsApiService.getApiUsage();
      res.json(usage);
    } catch (error) {
      console.error("Error fetching API usage:", error);
      res.status(500).json({ message: "Failed to fetch API usage" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
