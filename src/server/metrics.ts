import { sql } from "drizzle-orm"
import { participant } from "./db/schema"
import type { SQL } from "drizzle-orm"

/** How a metric's value reads: a plain number, a share of Games, or a decimal. */
export type MetricUnit = "count" | "percent" | "decimal"

/**
 * A statistic the Group Leaderboard ranks by (and, later, Personal Stats).
 * A new metric is a new entry in `METRICS` (plus its icon in the
 * Leaderboard tab): it applies to every completed Game at once. It counts
 * the summary columns of `participant`, which are derived from the Game's
 * Events when it is completed and cleared when that end is undone, so they
 * can always be rebuilt from the Events (ADR 0001).
 */
export type MetricDefinition = {
  id: string
  /** Shown on the selector and in the metric sheet. */
  name: string
  /** One line below the name: what it measures. */
  description: string
  unit: MetricUnit
  /** Which end of the ranking is best: "desc" puts the highest value first. */
  order: "desc" | "asc"
  /**
   * Below this many Games a player is not ranked yet but listed apart, for
   * rates that mean little after a Game or two. Null: everyone is ranked.
   */
  minGames: number | null
  /**
   * What is counted: an aggregate over one player's Participants in completed
   * Games (a row of `participant`, with the summary columns written when the
   * Game finished). Must return an integer.
   */
  count: SQL<number>
  /** The value is `count` per Game played rather than `count` itself. */
  perGame: boolean
  /** The line below the value, e.g. "14 von 64". */
  detail: (stats: { count: number; games: number }) => string
}

const gamesPlayed = sql<number>`count(*)::int`

function countWhere(condition: SQL): SQL<number> {
  return sql<number>`(count(*) filter (where ${condition}))::int`
}

/** The metrics, in the order the metric sheet lists them. */
export const METRICS = [
  {
    id: "wins",
    name: "Siege",
    description: "Meiste Siege",
    unit: "count",
    order: "desc",
    minGames: null,
    count: countWhere(sql`${participant.won}`),
    perGame: false,
    detail: ({ games }) =>
      games === 1 ? "aus 1 Spiel" : `aus ${games} Spielen`,
  },
  {
    id: "winRate",
    name: "Winrate",
    description: "Siege pro Spiel, ab 5 Spielen",
    unit: "percent",
    order: "desc",
    minGames: 5,
    count: countWhere(sql`${participant.won}`),
    perGame: true,
    detail: ({ count, games }) => `${count} von ${games}`,
  },
  {
    id: "games",
    name: "Teilnahmen",
    description: "Meiste Spiele",
    unit: "count",
    order: "desc",
    minGames: null,
    count: gamesPlayed,
    perGame: false,
    detail: ({ games }) => (games === 1 ? "Spiel" : "Spiele"),
  },
  {
    id: "bombsPerGame",
    name: "Bomben pro Spiel",
    description: "Ab 5 Spielen",
    unit: "decimal",
    order: "desc",
    minGames: 5,
    count: sql<number>`coalesce(sum(${participant.bombs}), 0)::int`,
    perGame: true,
    detail: ({ count }) => (count === 1 ? "1 Bombe" : `${count} Bomben`),
  },
  {
    id: "swimRate",
    name: "Schwimmer-Quote",
    description: "Wie oft geschwommen, ab 5 Spielen",
    unit: "percent",
    order: "desc",
    minGames: 5,
    count: countWhere(sql`${participant.swam}`),
    perGame: true,
    detail: ({ count, games }) => `${count} von ${games}`,
  },
  {
    id: "unbreakable",
    name: "Unbreakable",
    description: "Siege als Schwimmer",
    unit: "count",
    order: "desc",
    minGames: null,
    count: countWhere(sql`${participant.won} and ${participant.swam}`),
    perGame: false,
    detail: () => "als Schwimmer gewonnen",
  },
  {
    id: "untouchable",
    name: "Untouchable",
    description: "Siege ohne verlorenes Leben",
    unit: "count",
    order: "desc",
    minGames: null,
    count: countWhere(sql`${participant.won} and ${participant.livesLost} = 0`),
    perGame: false,
    detail: () => "ohne Lebensverlust",
  },
] as const satisfies ReadonlyArray<MetricDefinition>

export type MetricId = (typeof METRICS)[number]["id"]
