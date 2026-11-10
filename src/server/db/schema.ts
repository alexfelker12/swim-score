import { relations } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import type { GameEvent, RuleSet } from "@/rules-engine"

export const THEMES = ["system", "light", "dark"] as const
export type Theme = (typeof THEMES)[number]

// Auth tables in the shape better-auth expects (core schema + `username`
// plugin + our additional `theme` field).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  /** Display name, freely changeable; shown in Games and Leaderboards. */
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  /** Login name, normalised to lower case; cannot be changed. */
  username: text("username").unique(),
  /** The username as the person typed it. */
  displayUsername: text("display_username"),
  theme: text("theme", { enum: THEMES }).default("dark").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
})

/**
 * The square part of the source image shown in the avatar, independent of
 * its pixel size: `x` is a fraction of its width, `y` of its height, and
 * `size` (the square's side) of its shorter side.
 */
export type AvatarCrop = { x: number; y: number; size: number }

/**
 * An uploaded profile picture: the 256 px avatar everyone sees, plus the
 * (downscaled) source image and crop so its owner can adjust it later. One
 * per account; a new picture replaces all three.
 */
export const avatar = pgTable("avatar", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  /** Missing for pictures stored before cropping existed. */
  sourceContentType: text("source_content_type"),
  source: bytea("source"),
  crop: jsonb("crop").$type<AvatarCrop>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/** A fixed circle of people who play together; see CONTEXT.md › Group. */
export const group = pgTable("group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** The Group Admin: an account that is a Player of this Group. */
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id),
  /**
   * The secret in the Group's Invite link and QR code. Renewing the Invite
   * replaces it, which makes the old link and code invalid.
   */
  inviteToken: text("invite_token")
    .notNull()
    .unique()
    .$defaultFn(newInviteToken),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/** 128 random bits, URL-safe: knowing it is all it takes to join the Group. */
export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Buffer.from(bytes).toString("base64url")
}

/**
 * A Player of a Group: linked to an account, or a Guest (no account, own
 * name). An account is at most one Player per Group.
 */
export const player = pgTable(
  "player",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    /** Null for a Guest. */
    userId: text("user_id").references(() => user.id),
    /** The Guest's name; Players with an account show their Display Name. */
    name: text("name"),
    /** The account that added this Guest; null for Players with an account. */
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("player_group_id_idx").on(table.groupId),
    uniqueIndex("player_group_user_idx").on(table.groupId, table.userId),
  ]
)

/**
 * A Claim: a Player with an account says they are a Guest of the Group and
 * waits for the Group Admin to confirm it. A Player has at most one open
 * Claim; it goes away with either of its Players.
 */
export const claim = pgTable(
  "claim",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    /** The claiming account's own Player. */
    playerId: text("player_id")
      .notNull()
      .unique()
      .references(() => player.id, { onDelete: "cascade" }),
    /** The Guest they say they are. */
    guestId: text("guest_id")
      .notNull()
      .references(() => player.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("claim_group_id_idx").on(table.groupId)]
)

export const GAME_STATUSES = ["running", "finished", "cancelled"] as const
export type GameStatus = (typeof GAME_STATUSES)[number]

/**
 * A Game within a Group. Its state is not stored: it follows from its Events
 * (ADR 0001). `version` counts the recorded Events, so a device can only
 * record on top of the state it has seen (ADR 0002).
 */
export const game = pgTable(
  "game",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => group.id, { onDelete: "cascade" }),
    ruleSet: jsonb("rule_set").$type<RuleSet>().notNull(),
    status: text("status", { enum: GAME_STATUSES })
      .default("running")
      .notNull(),
    /** The Scorekeeper: the only account that may record Events. */
    scorekeeperId: text("scorekeeper_id")
      .notNull()
      .references(() => user.id),
    version: integer("version").default(0).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => [index("game_group_id_idx").on(table.groupId)]
)

/**
 * A Player taking part in a Game, at a seat of the Seating Order (0 deals
 * first). Events refer to Participants, not Players, so linking a Guest to an
 * account later moves their Games with them. The summary columns are written
 * when the Game finishes.
 */
export const participant = pgTable(
  "participant",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => player.id),
    seat: integer("seat").notNull(),
    won: boolean("won"),
    /** Was the Game's Swimmer. */
    swam: boolean("swam"),
    bombs: integer("bombs"),
    /** Rounds that went against them, becoming the Swimmer included. */
    livesLost: integer("lives_lost"),
    /** 1 for the first to go Out; those Out in the same Round share it. Null for the Winner. */
    outPosition: integer("out_position"),
  },
  (table) => [
    uniqueIndex("participant_game_seat_idx").on(table.gameId, table.seat),
    uniqueIndex("participant_game_player_idx").on(table.gameId, table.playerId),
  ]
)

/** One recorded Event; `version` is its position in the Game, from 1. */
export const gameEvent = pgTable(
  "game_event",
  {
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    event: jsonb("event").$type<GameEvent>().notNull(),
    recordedById: text("recorded_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.version] })]
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const groupRelations = relations(group, ({ one, many }) => ({
  admin: one(user, { fields: [group.adminId], references: [user.id] }),
  players: many(player),
  claims: many(claim),
  games: many(game),
}))

export const gameRelations = relations(game, ({ one, many }) => ({
  group: one(group, { fields: [game.groupId], references: [group.id] }),
  scorekeeper: one(user, {
    fields: [game.scorekeeperId],
    references: [user.id],
  }),
  participants: many(participant),
  events: many(gameEvent),
}))

export const participantRelations = relations(participant, ({ one }) => ({
  game: one(game, { fields: [participant.gameId], references: [game.id] }),
  player: one(player, {
    fields: [participant.playerId],
    references: [player.id],
  }),
}))

export const gameEventRelations = relations(gameEvent, ({ one }) => ({
  game: one(game, { fields: [gameEvent.gameId], references: [game.id] }),
}))

export const claimRelations = relations(claim, ({ one }) => ({
  group: one(group, { fields: [claim.groupId], references: [group.id] }),
  player: one(player, {
    fields: [claim.playerId],
    references: [player.id],
  }),
  guest: one(player, {
    fields: [claim.guestId],
    references: [player.id],
  }),
}))

export const playerRelations = relations(player, ({ one }) => ({
  group: one(group, { fields: [player.groupId], references: [group.id] }),
  user: one(user, { fields: [player.userId], references: [user.id] }),
  createdBy: one(user, {
    fields: [player.createdById],
    references: [user.id],
  }),
}))
