import { preview, replay } from "@/rules-engine"
import type { Effects, GameEvent, GameState, RuleSet } from "@/rules-engine"

// The German texts for Events, the same wherever an Event is shown (bottom
// bar, history, live view).

type Names = (id: string) => string

/** "Anna", "Anna und Ben", "Anna, Ben und Carla". */
export function joinNames(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`
}

/** "Carlas", "Jonas’" */
export function genitive(name: string): string {
  return /[sßxz]$/i.test(name) ? `${name}’` : `${name}s`
}

/**
 * What the Event did, e.g. "Ben verliert ein Leben", "Carla wirft eine
 * Bombe, Dario schwimmt, Ben scheidet aus", "Ben verliert ein Leben, Stechen
 * mit Anna" or "Dario scheidet aus, Anna gewinnt". `state` is the state before it. `withWinner: false` leaves out
 * who wins (the Winner sheet says so in its heading).
 */
export function describeEvent(
  state: GameState,
  ruleSet: RuleSet,
  event: GameEvent,
  name: Names,
  { withWinner = true } = {}
): string {
  const result = preview(state, ruleSet, event)
  if (!result.ok) return ""
  const { text, note } = describeEffects(
    state,
    ruleSet,
    event,
    result.effects,
    name
  )
  // A Tiebreak says why the loser lost, so it takes the note's place.
  const tiebreak =
    event.type === "lost" && event.tiebreak
      ? `Stechen mit ${joinNames(tiebreakOthers(event).map(name))}`
      : note
  const full = tiebreak ? `${text}, ${tiebreak}` : text
  return withWinner ? withWinnerOf(full, result.effects, name) : full
}

/** "…, Anna gewinnt" when the Event ends the Game. */
function withWinnerOf(text: string, { winner }: Effects, name: Names) {
  return winner ? `${text}, ${name(winner)} gewinnt` : text
}

/** Who was in the loss's Tiebreak besides the loser. */
function tiebreakOthers(event: Extract<GameEvent, { type: "lost" }>) {
  return (event.tiebreak ?? []).filter((id) => id !== event.loser)
}

/** One Round in the Game's history ("Spielverlauf"). */
export type HistoryEntry = {
  /** The Round's number. */
  round: number
  /** "Ben verliert ein Leben", "Anna wirft eine Bombe", "Extra-Runde" … */
  text: string
  /** "Dealer Anna", "Dealer Emil, es gab schon einen Schwimmer" … */
  meta: string
  bomb: boolean
  extraRound: boolean
  /** The Event that ended the Game. */
  end: boolean
}

/** The Game Round by Round, from its Events. */
export function describeHistory(
  ruleSet: RuleSet,
  seatingOrder: ReadonlyArray<string>,
  events: ReadonlyArray<GameEvent>,
  name: Names
): Array<HistoryEntry> {
  let state = replay(ruleSet, [...seatingOrder], [])
  const entries: Array<HistoryEntry> = []
  let afterExtraRound = false
  for (const event of events) {
    const result = preview(state, ruleSet, event)
    if (!result.ok) break
    const { text, note } = describeEffects(
      state,
      ruleSet,
      event,
      result.effects,
      name
    )
    // An Extra Round is dealt again by the same Dealer.
    const meta = [
      afterExtraRound
        ? `Dealer bleibt ${name(state.dealer)}`
        : `Dealer ${name(state.dealer)}`,
    ]
    if (note) meta.push(note)
    if (event.type === "bomb" && event.swimmer) meta.push("Schwimmer per Wahl")
    if (event.type === "lost" && event.tiebreak) {
      meta.push(`Stechen mit ${joinNames(tiebreakOthers(event).map(name))}`)
    }
    if (event.type === "extraRound") {
      const remaining = state.participants.filter((p) => p.status !== "out")
      meta.push(`${joinNames(remaining.map((p) => name(p.id)))} gleichauf`)
    }
    entries.push({
      round: state.round,
      text:
        event.type === "extraRound"
          ? "Extra-Runde"
          : withWinnerOf(text, result.effects, name),
      meta: meta.join(", "),
      bomb: event.type === "bomb",
      extraRound: event.type === "extraRound",
      end: result.state.finished,
    })
    afterExtraRound = event.type === "extraRound"
    state = result.state
  }
  return entries
}

/** "10 Runden, 1 Extra-Runde, 6 Teilnehmer"; Rounds played so far. */
export function describeGameLength(
  events: ReadonlyArray<GameEvent>,
  state: GameState,
  participantCount: number
): string {
  const rounds = state.finished ? state.round : state.round - 1
  const extraRounds = events.filter((e) => e.type === "extraRound").length
  return [
    `${rounds} ${rounds === 1 ? "Runde" : "Runden"}`,
    extraRounds > 0
      ? `${extraRounds} ${extraRounds === 1 ? "Extra-Runde" : "Extra-Runden"}`
      : null,
    `${participantCount} Teilnehmer`,
  ]
    .filter(Boolean)
    .join(", ")
}

/**
 * What the Event did, and an explaining note the history shows apart
 * ("es gab schon einen Schwimmer").
 */
function describeEffects(
  state: GameState,
  ruleSet: RuleSet,
  event: GameEvent,
  { becameSwimmer, out }: Effects,
  name: Names
): { text: string; note?: string } {
  switch (event.type) {
    case "lost": {
      const loser = name(event.loser)
      if (becameSwimmer === event.loser)
        return { text: `${loser} schwimmt jetzt` }
      if (!out.includes(event.loser)) {
        return { text: `${loser} verliert ein Leben` }
      }
      return state.swimmer !== event.loser && ruleSet.swimmer
        ? {
            text: `${loser} scheidet aus`,
            note: "es gab schon einen Schwimmer",
          }
        : { text: `${loser} scheidet aus` }
    }
    case "bomb": {
      const parts = [`${name(event.thrower)} wirft eine Bombe`]
      if (becameSwimmer) parts.push(`${name(becameSwimmer)} schwimmt`)
      if (out.length > 0) {
        const verb = out.length > 1 ? "scheiden aus" : "scheidet aus"
        parts.push(`${joinNames(out.map(name))} ${verb}`)
      }
      return { text: parts.join(", ") }
    }
    case "extraRound":
      return { text: `Extra-Runde, Dealer bleibt ${name(state.dealer)}` }
  }
}
