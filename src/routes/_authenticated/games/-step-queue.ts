import type { GameEvent } from "@/rules-engine"
import type { GameView } from "@/server/games"

// The Scorekeeper's steps not yet taken by the server (ADR 0007): kept on
// this device for the signed-in account, also across a reload, and sent one
// after another in order, each on top of the version the one before
// produced. The queue stays thin: it sends what the server commands accept
// or refuse, and reads the Game to learn whether a step whose answer got
// lost arrived.

/** A step of the Scorekeeper, as queued. */
export type QueuedStep = (
  | { kind: "record"; event: GameEvent }
  | { kind: "undo" }
  | { kind: "tiebreak"; tiebreak: Array<string> }
) & {
  /**
   * Shown at once. False for the steps that change the screen (the Event
   * that ends the Game, undoing that end): they show once the server has
   * them.
   */
  optimistic: boolean
}

export type QueueState = {
  /** The Game's version the first step goes on top of. */
  baseVersion: number
  steps: ReadonlyArray<QueuedStep>
  /** The first step is on its way. */
  sending: boolean
  /** No connection since the last attempt; tried again until it works. */
  offline: boolean
}

export const emptyQueue: QueueState = {
  baseVersion: 0,
  steps: [],
  sending: false,
  offline: false,
}

/** What the server said to a step. */
export type SendResult =
  { ok: true; version: number } | { ok: false; code: string }

/** How the queue's steps were refused, for telling the Scorekeeper. */
export type Refusal = {
  code: string
  /** The Events among the dropped steps. */
  discardedRounds: number
  /** The steps had waited without a connection. */
  afterOffline: boolean
}

export type QueueHandlers = {
  /** Sends one step. Throws a `TypeError` when the server cannot be reached. */
  send: (step: QueuedStep, expectedVersion: number) => Promise<SendResult>
  /** The Game as the server has it now; throws like `send`. */
  read: () => Promise<GameView | null>
  /** The server took the step and is now at `version`. */
  confirmed: (
    step: QueuedStep,
    expectedVersion: number,
    version: number
  ) => void
  /** The server refused a step: it and everything after it were dropped. */
  refused: (refusal: Refusal) => void
  /** Nothing is left to send: load the Game again. */
  drained: () => void
}

const RETRY_MS = 5_000
/** Errors other than a missing connection are tried this often, then dropped. */
const MAX_FAILURES = 3

export class StepQueue {
  private state: QueueState
  private listeners = new Set<() => void>()
  private handlers: QueueHandlers | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private waiters: Array<(sent: boolean) => void> = []
  /** The first step was sent but no answer came: it may have arrived. */
  private uncertain: boolean
  private failures = 0
  /** Some step waited without a connection since the queue was last empty. */
  private wasOffline = false
  /** A refusal that came while no screen was attached, told on the next. */
  private untold: Refusal | null = null

  constructor(private readonly storageKey: string | null) {
    this.state = { ...emptyQueue, ...load(storageKey) }
    // Steps from before a reload may have reached the server already.
    this.uncertain = this.state.steps.length > 0
  }

  get = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** The screen showing the Game sends and hears back until it detaches. */
  attach(handlers: QueueHandlers): () => void {
    this.handlers = handlers
    if (this.untold) {
      handlers.refused(this.untold)
      this.untold = null
      handlers.drained()
    }
    void this.flush()
    return () => {
      if (this.handlers === handlers) this.handlers = null
      this.clearRetry()
    }
  }

  /** Adds a step on top of what is shown; `serverVersion` when the queue is empty. */
  push(step: QueuedStep, serverVersion: number) {
    const { steps } = this.state
    this.set({
      baseVersion: steps.length === 0 ? serverVersion : this.state.baseVersion,
      steps: [...steps, step],
    })
    void this.flush()
  }

  /**
   * Undoes the last step shown. One not sent yet is simply dropped (with
   * the loss its Tiebreak was added to, if that is unsent too, since undo
   * takes back the loss); otherwise the undo is queued for the server.
   */
  undo(serverVersion: number, optimistic: boolean) {
    const { steps } = this.state
    const last = steps.length - 1
    if (this.droppable(last) && steps[last].kind === "record") {
      this.set({ steps: steps.slice(0, -1) })
      return
    }
    if (this.droppable(last) && steps[last].kind === "tiebreak") {
      if (this.droppable(last - 1) && steps[last - 1].kind === "record") {
        this.set({ steps: steps.slice(0, -2) })
        return
      }
      // The loss is on the server: undoing it takes the Tiebreak with it.
      this.set({ steps: [...steps.slice(0, -1), { kind: "undo", optimistic }] })
      void this.flush()
      return
    }
    this.push({ kind: "undo", optimistic }, serverVersion)
  }

  /**
   * Drops the last step if it is one that waits for the server (the end of
   * the Game) and has not left this device; true if it did.
   */
  dropUnsentEnd(): boolean {
    const { steps } = this.state
    const last = steps.length - 1
    if (!this.droppable(last) || steps[last].optimistic) return false
    this.set({ steps: steps.slice(0, -1) })
    return true
  }

  /** Throws everything away, for a Game that is over without these steps. */
  clear() {
    if (this.state.steps.length > 0 && !this.state.sending) {
      this.set({ steps: [] })
    }
  }

  /**
   * Resolves once everything is sent (true), or when it cannot be: without
   * a connection, or refused (false).
   */
  sent(): Promise<boolean> {
    if (this.state.steps.length === 0) return Promise.resolve(true)
    if (this.state.offline) return Promise.resolve(false)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  /** Sends the first step, and on success the next, until none is left. */
  flush = async (): Promise<void> => {
    const { steps, sending, baseVersion } = this.state
    if (!this.handlers || sending || steps.length === 0) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return this.goneOffline()
    }
    const step = steps[0]
    this.set({ sending: true })
    let result: SendResult
    try {
      result =
        this.uncertain && (await this.arrived(step, baseVersion))
          ? { ok: true, version: baseVersion + 1 }
          : await this.need().send(step, baseVersion)
    } catch (error) {
      if (error instanceof TypeError) return this.goneOffline()
      // A server error: neither the connection nor a refusal.
      this.set({ sending: false })
      if (++this.failures < MAX_FAILURES) return this.retryLater()
      result = { ok: false, code: "serverError" }
    }
    this.uncertain = false
    this.failures = 0
    if (!result.ok) return this.refuse(result.code)
    // The screen may have gone while the step was on its way.
    const handlers = this.handlers as QueueHandlers | null
    handlers?.confirmed(step, baseVersion, result.version)
    this.set({
      baseVersion: result.version,
      steps: this.state.steps.slice(1),
      sending: false,
      offline: false,
    })
    if (this.state.steps.length > 0) return this.flush()
    this.finish(true)
  }

  /**
   * Whether a step whose answer got lost reached the server: it is at the
   * next version, with that Event (or Tiebreak) last.
   */
  private async arrived(step: QueuedStep, baseVersion: number) {
    const game = await this.need().read()
    if (!game || game.version !== baseVersion + 1) return false
    const last = game.events.at(-1)
    if (step.kind === "record") return sameJson(last, step.event)
    if (step.kind === "tiebreak") {
      return last?.type === "lost" && sameJson(last.tiebreak, step.tiebreak)
    }
    return true
  }

  private refuse(code: string) {
    const refusal: Refusal = {
      code,
      discardedRounds: this.state.steps.filter((s) => s.kind === "record")
        .length,
      afterOffline: this.wasOffline,
    }
    this.set({ steps: [], sending: false, offline: false })
    if (this.handlers) this.handlers.refused(refusal)
    else this.untold = refusal
    this.finish(false)
  }

  private goneOffline() {
    // The next attempt cannot know whether this one arrived.
    this.uncertain = true
    this.wasOffline = true
    this.set({ sending: false, offline: true })
    this.waiters.splice(0).forEach((resolve) => resolve(false))
    this.retryLater()
  }

  private finish(sent: boolean) {
    this.wasOffline = false
    this.handlers?.drained()
    this.waiters.splice(0).forEach((resolve) => resolve(sent))
  }

  private need(): QueueHandlers {
    if (!this.handlers) throw new Error("No screen attached to the step queue")
    return this.handlers
  }

  /** A step that has not left this device. */
  private droppable(index: number) {
    return index >= 0 && (index > 0 || !this.state.sending)
  }

  private retryLater() {
    if (this.retry || !this.handlers) return
    this.retry = setTimeout(() => {
      this.retry = null
      void this.flush()
    }, RETRY_MS)
  }

  private clearRetry() {
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
  }

  private set(changes: Partial<QueueState>) {
    this.state = { ...this.state, ...changes }
    // With nothing left to send, there is nothing to be offline about.
    if (this.state.steps.length === 0 && this.state.offline) {
      this.state = { ...this.state, offline: false }
    }
    save(this.storageKey, this.state)
    this.listeners.forEach((listener) => listener())
  }
}

/** Events and Tiebreaks are plain data: equal when their JSON is. */
function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

const queues = new Map<string, StepQueue>()

/**
 * The one queue of a Game for the signed-in account on this device. On the
 * server, where nothing is queued, a fresh empty one each time.
 */
export function stepQueue(gameId: string, viewerId: string): StepQueue {
  if (typeof window === "undefined") return new StepQueue(null)
  const key = `swim-score:steps:${viewerId}:${gameId}`
  let queue = queues.get(key)
  if (!queue) {
    queue = new StepQueue(key)
    queues.set(key, queue)
  }
  return queue
}

// Sending again as soon as the connection is back, not only on the timer.
if (typeof window !== "undefined") {
  window.addEventListener("online", () =>
    queues.forEach((queue) => void queue.flush())
  )
}

/** Only what is needed after a reload; storage can fail (private mode, full). */
function save(key: string | null, state: QueueState) {
  if (!key) return
  try {
    if (state.steps.length === 0) localStorage.removeItem(key)
    else
      localStorage.setItem(
        key,
        JSON.stringify({ baseVersion: state.baseVersion, steps: state.steps })
      )
  } catch {
    // The queue still works for this page; it just will not survive a reload.
  }
}

function load(key: string | null): Partial<QueueState> {
  if (!key) return {}
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return {}
    const { baseVersion, steps } = JSON.parse(stored) as {
      baseVersion: number
      steps: Array<QueuedStep>
    }
    return { baseVersion, steps }
  } catch {
    return {}
  }
}
