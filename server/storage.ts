import {
  users,
  sports,
  games,
  bookmakers,
  odds,
  lineMovements,
  userFavorites,
  userAlerts,
  type User,
  type UpsertUser,
  type Sport,
  type Game,
  type Bookmaker,
  type Odds,
  type LineMovement,
  type UserFavorite,
  type UserAlert,
  type InsertUserFavorite,
  type InsertUserAlert,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Sports operations
  getSports(): Promise<Sport[]>;
  upsertSport(sport: Partial<Sport>): Promise<Sport>;
  
  // Games operations
  getGamesBySport(sportId: string): Promise<Game[]>;
  getUpcomingGames(): Promise<Game[]>;
  upsertGame(game: Partial<Game>): Promise<Game>;
  getGameById(id: string): Promise<Game | undefined>;
  
  // Bookmakers operations
  getBookmakers(): Promise<Bookmaker[]>;
  upsertBookmaker(bookmaker: Partial<Bookmaker>): Promise<Bookmaker>;
  
  // Odds operations
  getOddsByGame(gameId: string): Promise<Odds[]>;
  upsertOdds(oddsData: Partial<Odds>): Promise<Odds>;
  getBestOdds(gameId: string, market: string): Promise<Odds[]>;
  
  // Line movements
  getLineMovements(gameId: string, hours?: number): Promise<LineMovement[]>;
  createLineMovement(movement: Partial<LineMovement>): Promise<LineMovement>;
  getBigMovers(hours?: number, minMovement?: number): Promise<(LineMovement & { game: Game })[]>;
  
  // User favorites
  getUserFavorites(userId: string): Promise<(UserFavorite & { game: Game })[]>;
  toggleUserFavorite(data: InsertUserFavorite): Promise<{ favorited: boolean }>;
  
  // User alerts
  getUserAlerts(userId: string): Promise<(UserAlert & { game: Game })[]>;
  createUserAlert(data: InsertUserAlert): Promise<UserAlert>;
  deleteUserAlert(id: string, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Sports operations
  async getSports(): Promise<Sport[]> {
    return await db.select().from(sports).where(eq(sports.active, true));
  }

  async upsertSport(sport: Partial<Sport>): Promise<Sport> {
    const [result] = await db
      .insert(sports)
      .values(sport as any)
      .onConflictDoUpdate({
        target: sports.id,
        set: sport,
      })
      .returning();
    return result;
  }

  // Games operations
  async getGamesBySport(sportId: string): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(and(
        eq(games.sportId, sportId),
        eq(games.completed, false),
        gte(games.commenceTime, new Date())
      ))
      .orderBy(games.commenceTime);
  }

  async getUpcomingGames(): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(and(
        eq(games.completed, false),
        gte(games.commenceTime, new Date())
      ))
      .orderBy(games.commenceTime)
      .limit(50);
  }

  async upsertGame(game: Partial<Game>): Promise<Game> {
    const [result] = await db
      .insert(games)
      .values(game as any)
      .onConflictDoUpdate({
        target: games.id,
        set: {
          ...game,
          lastUpdated: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getGameById(id: string): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  // Bookmakers operations
  async getBookmakers(): Promise<Bookmaker[]> {
    return await db.select().from(bookmakers);
  }

  async upsertBookmaker(bookmaker: Partial<Bookmaker>): Promise<Bookmaker> {
    const [result] = await db
      .insert(bookmakers)
      .values(bookmaker as any)
      .onConflictDoUpdate({
        target: bookmakers.id,
        set: bookmaker,
      })
      .returning();
    return result;
  }

  // Odds operations
  async getOddsByGame(gameId: string): Promise<Odds[]> {
    return await db
      .select()
      .from(odds)
      .where(eq(odds.gameId, gameId))
      .orderBy(desc(odds.lastUpdate));
  }

  async upsertOdds(oddsData: Partial<Odds>): Promise<Odds> {
    const [result] = await db
      .insert(odds)
      .values(oddsData as any)
      .onConflictDoUpdate({
        target: [odds.gameId, odds.bookmakerId, odds.market, odds.outcomeType],
        set: {
          ...oddsData,
          lastUpdate: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getBestOdds(gameId: string, market: string): Promise<Odds[]> {
    return await db
      .select({
        id: odds.id,
        gameId: odds.gameId,
        bookmakerId: odds.bookmakerId,
        market: odds.market,
        outcomeType: odds.outcomeType,
        price: odds.price,
        point: odds.point,
        lastUpdate: odds.lastUpdate,
        bookmakerTitle: bookmakers.title,
      })
      .from(odds)
      .innerJoin(bookmakers, eq(odds.bookmakerId, bookmakers.id))
      .where(and(eq(odds.gameId, gameId), eq(odds.market, market)))
      .orderBy(desc(odds.price));
  }

  // Line movements
  async getLineMovements(gameId: string, hours: number = 24): Promise<LineMovement[]> {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db
      .select()
      .from(lineMovements)
      .where(and(
        eq(lineMovements.gameId, gameId),
        gte(lineMovements.timestamp, hoursAgo)
      ))
      .orderBy(desc(lineMovements.timestamp));
  }

  async createLineMovement(movement: Partial<LineMovement>): Promise<LineMovement> {
    const [result] = await db
      .insert(lineMovements)
      .values(movement as any)
      .returning();
    return result;
  }

  async getBigMovers(hours: number = 2, minMovement: number = 1): Promise<(LineMovement & { game: Game })[]> {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db
      .select({
        id: lineMovements.id,
        gameId: lineMovements.gameId,
        market: lineMovements.market,
        oldValue: lineMovements.oldValue,
        newValue: lineMovements.newValue,
        movement: lineMovements.movement,
        timestamp: lineMovements.timestamp,
        game: games,
      })
      .from(lineMovements)
      .innerJoin(games, eq(lineMovements.gameId, games.id))
      .where(and(
        gte(lineMovements.timestamp, hoursAgo),
        sql`abs(${lineMovements.movement}) >= ${minMovement}`
      ))
      .orderBy(desc(lineMovements.timestamp))
      .limit(10);
  }

  // User favorites
  async getUserFavorites(userId: string): Promise<(UserFavorite & { game: Game })[]> {
    return await db
      .select({
        id: userFavorites.id,
        userId: userFavorites.userId,
        gameId: userFavorites.gameId,
        createdAt: userFavorites.createdAt,
        game: games,
      })
      .from(userFavorites)
      .innerJoin(games, eq(userFavorites.gameId, games.id))
      .where(eq(userFavorites.userId, userId))
      .orderBy(desc(userFavorites.createdAt));
  }

  async toggleUserFavorite(data: InsertUserFavorite): Promise<{ favorited: boolean }> {
    const existing = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, data.userId),
        eq(userFavorites.gameId, data.gameId)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(userFavorites)
        .where(eq(userFavorites.id, existing[0].id));
      return { favorited: false };
    } else {
      await db.insert(userFavorites).values(data);
      return { favorited: true };
    }
  }

  // User alerts
  async getUserAlerts(userId: string): Promise<(UserAlert & { game: Game })[]> {
    return await db
      .select({
        id: userAlerts.id,
        userId: userAlerts.userId,
        gameId: userAlerts.gameId,
        market: userAlerts.market,
        threshold: userAlerts.threshold,
        isActive: userAlerts.isActive,
        createdAt: userAlerts.createdAt,
        game: games,
      })
      .from(userAlerts)
      .innerJoin(games, eq(userAlerts.gameId, games.id))
      .where(and(
        eq(userAlerts.userId, userId),
        eq(userAlerts.isActive, true)
      ))
      .orderBy(desc(userAlerts.createdAt));
  }

  async createUserAlert(data: InsertUserAlert): Promise<UserAlert> {
    const [result] = await db
      .insert(userAlerts)
      .values(data)
      .returning();
    return result;
  }

  async deleteUserAlert(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(userAlerts)
      .where(and(
        eq(userAlerts.id, id),
        eq(userAlerts.userId, userId)
      ));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
