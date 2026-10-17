// A session kept across the states of one "shown" phase (a tooltip's or hover card's open ↔
// closing): leaving a state cleans its effects, so the cleanup only hands the session over
// for a microtask; the next state's effect takes it back, and only a real close tears it
// down. Shared by every hover-opened layer.

/**
 * Keeps one session (layer, hover tracking, positioning) across open ↔ closing: leaving a
 * state cleans its effects, so the cleanup only hands the session over for a microtask;
 * the next state's effect takes it back, and only a real close tears it down.
 */
export interface Session<A, E = unknown> {
  stop: () => void
  pending: boolean
  /** The activation that owns it now: events and props always go through the current one. */
  owner: A
  /** The last placement, replayed to a new owner (positioning reports only changes). */
  placed: E | null
}
const sessions = new Map<string, Session<unknown, unknown>>()
export function session<A, E = unknown>(
  key: string,
  owner: A,
  start: (session: Session<A, E>) => () => void,
  adopted: (session: Session<A, E>) => void,
): () => void {
  // Sound: keys are namespaced per component and instance; one key is one owner type.
  const live = sessions.get(key) as Session<A, E> | undefined
  let s: Session<A, E>
  if (live) {
    // A restarted service (StrictMode, a remount) or open ↔ closing: the new activation
    // takes it over; the previous one's `send` is revoked.
    live.owner = owner
    s = live
    adopted(s)
  } else {
    s = { stop: () => {}, pending: false, owner, placed: null }
    s.stop = start(s)
  }
  s.pending = false
  // Sound: widening to the map's element type (read back through the cast above).
  sessions.set(key, s as Session<unknown, unknown>)
  return () => {
    s.pending = true
    queueMicrotask(() => {
      if (!s.pending || sessions.get(key) !== s) return
      sessions.delete(key)
      s.stop()
    })
  }
}
