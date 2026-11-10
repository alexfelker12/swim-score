import { preview } from "@/rules-engine"
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
 * Bombe, Dario schwimmt, Ben scheidet aus" or "Dario scheidet aus, Anna
 * gewinnt". `state` is the state before it. `withWinner: false` leaves out
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
  const text = describeEffects(state, ruleSet, event, result.effects, name)
  const { winner } = result.effects
  return withWinner && winner ? `${text}, ${name(winner)} gewinnt` : text
}

function describeEffects(
  state: GameState,
  ruleSet: RuleSet,
  event: GameEvent,
  { becameSwimmer, out }: Effects,
  name: Names
): string {
  switch (event.type) {
    case "lost": {
      const loser = name(event.loser)
      if (becameSwimmer === event.loser) return `${loser} schwimmt jetzt`
      if (!out.includes(event.loser)) return `${loser} verliert ein Leben`
      return state.swimmer !== event.loser && ruleSet.swimmer
        ? `${loser} scheidet aus, es gab schon einen Schwimmer`
        : `${loser} scheidet aus`
    }
    case "bomb": {
      const parts = [`${name(event.thrower)} wirft eine Bombe`]
      if (becameSwimmer) parts.push(`${name(becameSwimmer)} schwimmt`)
      if (out.length > 0) {
        const verb = out.length > 1 ? "scheiden aus" : "scheidet aus"
        parts.push(`${joinNames(out.map(name))} ${verb}`)
      }
      return parts.join(", ")
    }
    case "extraRound":
      return `Extra-Runde, Dealer bleibt ${name(state.dealer)}`
  }
}
