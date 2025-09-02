import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sports and leagues
export const sports = pgTable("sports", {
  id: varchar("id").primaryKey(), // e.g., 'americanfootball_nfl'
  title: varchar("title").notNull(), // e.g., 'NFL'
  description: text("description"),
  active: boolean("active").default(true),
  hasOutrights: boolean("has_outrights").default(false),
});

// Games/Events
export const games = pgTable("games", {
  id: varchar("id").primaryKey(), // The Odds API event ID
  sportId: varchar("sport_id").notNull().references(() => sports.id),
  homeTeam: varchar("home_team").notNull(),
  awayTeam: varchar("away_team").notNull(),
  commenceTime: timestamp("commence_time").notNull(),
  completed: boolean("completed").default(false),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Bookmakers
export const bookmakers = pgTable("bookmakers", {
  id: varchar("id").primaryKey(), // The Odds API bookmaker key
  title: varchar("title").notNull(),
  lastUpdate: timestamp("last_update"),
});

// Odds data
export const odds = pgTable("odds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: 'cascade' }),
  bookmakerId: varchar("bookmaker_id").notNull().references(() => bookmakers.id),
  market: varchar("market").notNull(), // 'h2h', 'spreads', 'totals'
  outcomeType: varchar("outcome_type").notNull(), // 'home', 'away', 'over', 'under'
  price: decimal("price", { precision: 10, scale: 2 }),
  point: decimal("point", { precision: 5, scale: 1 }), // For spreads and totals
  lastUpdate: timestamp("last_update").defaultNow(),
});

// Line movement history
export const lineMovements = pgTable("line_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: 'cascade' }),
  market: varchar("market").notNull(),
  oldValue: decimal("old_value", { precision: 5, scale: 1 }),
  newValue: decimal("new_value", { precision: 5, scale: 1 }),
  movement: decimal("movement", { precision: 5, scale: 1 }),
  timestamp: timestamp("timestamp").defaultNow(),
});

// User favorites
export const userFavorites = pgTable("user_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

// User alerts
export const userAlerts = pgTable("user_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: 'cascade' }),
  market: varchar("market").notNull(), // 'spreads', 'totals', 'h2h'
  threshold: decimal("threshold", { precision: 5, scale: 1 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  favorites: many(userFavorites),
  alerts: many(userAlerts),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  sport: one(sports, { fields: [games.sportId], references: [sports.id] }),
  odds: many(odds),
  lineMovements: many(lineMovements),
  userFavorites: many(userFavorites),
  userAlerts: many(userAlerts),
}));

export const oddsRelations = relations(odds, ({ one }) => ({
  game: one(games, { fields: [odds.gameId], references: [games.id] }),
  bookmaker: one(bookmakers, { fields: [odds.bookmakerId], references: [bookmakers.id] }),
}));

export const lineMovementsRelations = relations(lineMovements, ({ one }) => ({
  game: one(games, { fields: [lineMovements.gameId], references: [games.id] }),
}));

export const userFavoritesRelations = relations(userFavorites, ({ one }) => ({
  user: one(users, { fields: [userFavorites.userId], references: [users.id] }),
  game: one(games, { fields: [userFavorites.gameId], references: [games.id] }),
}));

export const userAlertsRelations = relations(userAlerts, ({ one }) => ({
  user: one(users, { fields: [userAlerts.userId], references: [users.id] }),
  game: one(games, { fields: [userAlerts.gameId], references: [games.id] }),
}));

// Insert schemas
export const insertSportSchema = createInsertSchema(sports);
export const insertGameSchema = createInsertSchema(games);
export const insertBookmakerSchema = createInsertSchema(bookmakers);
export const insertOddsSchema = createInsertSchema(odds);
export const insertLineMovementSchema = createInsertSchema(lineMovements);
export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({ id: true, createdAt: true });
export const insertUserAlertSchema = createInsertSchema(userAlerts).omit({ id: true, createdAt: true });

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Sport = typeof sports.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Bookmaker = typeof bookmakers.$inferSelect;
export type Odds = typeof odds.$inferSelect;
export type LineMovement = typeof lineMovements.$inferSelect;
export type UserFavorite = typeof userFavorites.$inferSelect;
export type UserAlert = typeof userAlerts.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;
export type InsertUserAlert = z.infer<typeof insertUserAlertSchema>;
