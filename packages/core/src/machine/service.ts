import type { SchedulerEnv } from "../env/capabilities"
import type {
  RawGuard,
  RawImplementations,
  RawMachineDef,
  RawStateDef,
  RawTransition,
  RawValue,
} from "./raw"
import type {
  AnyMachine,
  ChangeDetails,
  EnvOf,
  EventObject,
  MachinePropsOf,
  Service,
  Snapshot,
  Step,
} from "./types"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
// Unbundled ESM must define `process.env.NODE_ENV` (as for React).
declare const process: { env: { NODE_ENV?: string } }

type Props = Record<string, unknown>
type Event = EventObject & Record<string, unknown>
type RawSnapshot = Snapshot
type MutableSnapshot = { -readonly [K in keyof RawSnapshot]: RawSnapshot[K] }
/** "No proposal": removes the key from `proposed`. */
const NONE: unique symbol = Symbol("none")
const shallowEqual = (a: Props, b: Props) => {
  if (a === b) return true
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]))
}
const cap = (key: string) => key[0]?.toUpperCase() + key.slice(1)
const list = <T>(t: T | readonly T[] | undefined): readonly T[] =>
  t === undefined ? [] : Array.isArray(t) ? t : [t as T] // a non-array T is the single item

/**
 * Creates a service without side effects. Effects and delays start on `start()`; nothing
 * touches the environment before that except actions run by events sent before start.
 */
export function createService<M extends AnyMachine>(
  machine: M,
  initialProps: MachinePropsOf<M>,
  env: EnvOf<M>,
): Service<M> {
  // The public definition types are checked at `setup().machine()`; inside the runtime
  // the same objects are read through their structural, name-erased shape.
  const def = machine.def as unknown as RawMachineDef
  const impl = machine.impl as unknown as RawImplementations
  // Machines with delays require SchedulerEnv at the type level (Implementations.delays);
  // other machines never read it.
  const scheduler = (env as Partial<SchedulerEnv>).scheduler
  const values: Record<string, RawValue> = def.values ?? {}

  // Props are an object type for every machine (Types.props extends object).
  let props = initialProps as Props
  /** Prop-driven keys: controlled controllables and read-only bindings. */
  const fromProps: Record<string, boolean> = {}
  /** The last defined prop value, kept when a controlled key is later omitted. */
  const lastProp: Record<string, unknown> = {}
  const internal: Record<string, unknown> = {}
  for (const key in values) {
    fromProps[key] = values[key]?.readOnly === true || props[key] !== undefined
    lastProp[key] = props[key]
    if (!fromProps[key]) internal[key] = props[`default${cap(key)}`] ?? values[key]?.fallback
  }

  const eq = (key: string, a: unknown, b: unknown) => (values[key]?.equal ?? Object.is)(a, b)
  // A controlled `null` is a value (a Radio Group with nothing checked); only `undefined`
  // means omitted.
  const value = (key: string, p: Props = props) =>
    fromProps[key]
      ? p[key] !== undefined
        ? p[key]
        : lastProp[key] !== undefined
          ? lastProp[key]
          : values[key]?.fallback
      : snap.internal[key]
  const stateFor = (key: string, v: unknown) => {
    const bound = values[key]?.states
    // Several states may share a value (a tooltip's `opening` and `closed` are both closed):
    // the current one already holds it, so nothing moves.
    if (bound && snap.state in bound && eq(key, bound[snap.state], v)) return snap.state
    for (const s in bound) if (eq(key, bound[s], v)) return s
    return undefined
  }

  let snap: RawSnapshot = {
    state: def.initial,
    context: def.context?.(props) ?? {},
    internal,
    proposed: {},
  }
  // Read-only bindings decide first: only the parent can move the machine out of them.
  const byPrecedence = Object.keys(values).sort(
    (a, b) => Number(values[b]?.readOnly === true) - Number(values[a]?.readOnly === true),
  )
  for (const key of byPrecedence) {
    const s = stateFor(key, value(key))
    if (s !== undefined) {
      snap = { ...snap, state: s }
      break
    }
  }

  let started = false
  let revoked = false
  let entered = false
  let busy = false
  /** The props when the service stopped; start() replays the diff against them. */
  let stoppedWith: Props | undefined
  let stateCleanups: (() => void)[] = []
  let rootCleanups: (() => void)[] = []
  const queue: Event[] = []
  const listeners = new Set<() => void>()
  const inspectors = new Set<(step: Step) => void>()
  const warned = new Set<string>()

  const resolved = (p?: Props) => {
    const out: Record<string, unknown> = {}
    for (const key in values) out[key] = value(key, p)
    return out
  }
  const patch = (next: Partial<MutableSnapshot>) => {
    snap = { ...snap, ...next }
  }
  const setProposed = (key: string, v: unknown) => {
    const { [key]: _, ...rest } = snap.proposed
    patch({ proposed: v === NONE ? rest : { ...rest, [key]: v } })
  }

  const readArgs = (extra: object) =>
    Object.defineProperties(
      { env, ...extra },
      {
        props: { get: () => props, enumerable: true },
        context: { get: () => snap.context, enumerable: true },
        values: { get: () => resolved(), enumerable: true },
      },
    )

  /**
   * A controllable write. Controlled: recorded as a proposal *before* the callback, so a
   * parent that applies it synchronously (setProps inside onChange) finds it satisfied.
   * Uncontrolled: "commit" — the caller stores the value at the right point of the step.
   */
  const write = (
    key: string,
    v: unknown,
    event: Event,
    reason: string = event.type,
  ): "commit" | "propose" | "cancel" => {
    if (fromProps[key]) setProposed(key, v)
    let cancelled = false
    const details: ChangeDetails = {
      // Sound: a transition's declared reason is part of the machine's own reason union.
      reason: reason as ChangeDetails["reason"],
      event,
      cancel: () => {
        cancelled = true
      },
    }
    const onChange = props[`on${cap(key)}Change`]
    if (typeof onChange === "function") onChange(v, details)
    if (cancelled) {
      if (fromProps[key]) setProposed(key, NONE)
      queue.push({ type: "$reverted", key, value: v })
      return "cancel"
    }
    return fromProps[key] ? "propose" : "commit"
  }
  const commit = (key: string, v: unknown) => patch({ internal: { ...snap.internal, [key]: v } })

  /** `reason`: the transition's declared reason, for the controllable changes it makes. */
  const run = (
    names: readonly string[] | undefined,
    event: Event,
    ran: string[],
    reason?: string,
  ) => {
    for (const name of names ?? []) {
      impl.actions?.[name]?.(
        readArgs({
          event,
          send: (e: Event) => queue.push(e),
          set: (key: string, v: unknown) => {
            if (!(key in values)) {
              patch({ context: { ...snap.context, [key]: v } })
            } else if (!eq(key, v, value(key)) && write(key, v, event, reason) === "commit") {
              commit(key, v)
              const s = stateFor(key, v)
              if (s !== undefined && s !== snap.state) queue.push({ type: "$sync", key, value: v })
            }
          },
        }),
      )
      ran.push(name)
    }
  }

  const guard = (g: RawGuard | undefined, event: Event): boolean => {
    if (g === undefined) return true
    if (typeof g === "string") return impl.guards?.[g]?.(readArgs({ event })) ?? false
    if ("not" in g) return !guard(g.not, event)
    if ("and" in g) return g.and.every((x) => guard(x, event))
    return g.or.some((x) => guard(x, event))
  }

  /** Starts effects and delays; their sends are dropped once this activation is cleaned. */
  const activate = (effects: readonly string[] | undefined, sd: RawStateDef | undefined) => {
    let alive = true
    const cleanups: (() => void)[] = []
    const effectArgs = readArgs({
      send: (e: Event) => {
        if (alive) send(e)
      },
    })
    for (const name of effects ?? []) {
      const cleanup = impl.effects?.[name]?.(effectArgs)
      if (typeof cleanup === "function") cleanups.push(() => cleanup())
    }
    for (const name in sd?.after) {
      if (!scheduler) throw new Error(`${def.id}: delay "${name}" needs env.scheduler`)
      const ms = impl.delays?.[name]?.({ props }) ?? 0
      const handle = scheduler.setTimeout(() => alive && send({ type: `after:${name}` }), ms)
      cleanups.push(() => scheduler.clearTimeout(handle))
    }
    // Last, so it runs first: a send from an effect's own cleanup is already dropped.
    cleanups.push(() => {
      alive = false
    })
    return cleanups
  }
  /** Runs cleanups in reverse order of registration. */
  const cleanup = (cleanups: readonly (() => void)[]) => {
    for (let i = cleanups.length - 1; i >= 0; i--) cleanups[i]?.()
    return []
  }

  const take = (event: Event, t: RawTransition, sync: boolean) => {
    const source = snap.state
    const target = t.target
    const ran: string[] = []
    const commits: [string, unknown][] = []
    if (target !== undefined && target !== source && !sync) {
      // Read-only bindings first, before any side effect: only the parent moves the
      // machine into or out of a state bound to the prop's current value.
      for (const key in values) {
        const bound = values[key]?.states
        if (!values[key]?.readOnly || !bound) continue
        const current = value(key)
        const leavesBound = source in bound && eq(key, bound[source], current)
        const entersOther = target in bound && !eq(key, bound[target], current)
        if (leavesBound || entersOther) return
      }
      for (const key in values) {
        const bound = values[key]?.states
        if (values[key]?.readOnly || !bound || !(target in bound)) continue
        const v = bound[target]
        if (eq(key, v, value(key))) continue
        const result = write(key, v, event, t.reason)
        if (result === "commit") {
          commits.push([key, v])
          continue
        }
        // Proposed to the parent: the actions run, the state waits for `$sync`.
        // Cancelled: nothing runs.
        if (result === "propose") {
          run(t.actions, event, ran, t.reason)
          emit({ event, source, target: null, actions: ran })
        }
        return
      }
    }
    const change = target !== undefined && (target !== source || t.reenter === true)
    if (change) {
      if (entered) run(def.states[source]?.exit, event, ran)
      stateCleanups = cleanup(stateCleanups)
    }
    // Values change with the transition: exit actions still read the old ones.
    for (const [key, v] of commits) commit(key, v)
    run(t.actions, event, ran, t.reason)
    if (change) {
      patch({ state: target })
      entered = true
      const sd = def.states[target]
      run(sd?.entry, event, ran)
      if (started) stateCleanups = activate(sd?.effects, sd)
    }
    emit({ event, source, target: change ? target : null, actions: ran })
  }

  const emit = (step: Step) => {
    for (const i of inspectors) i(step)
  }

  const step = (event: Event) => {
    const { type } = event
    if (type === "$sync") {
      const target = stateFor(String(event["key"]), event["value"])
      if (target !== undefined && target !== snap.state) take(event, { target }, true)
      return
    }
    const sd = def.states[snap.state]
    const candidates = type.startsWith("after:")
      ? list(sd?.after?.[type.slice(6)])
      : // Root transitions are tried whenever no state transition was taken.
        [...list(sd?.on?.[type]), ...list(def.on?.[type])]
    for (const t of candidates) {
      const tr: RawTransition = typeof t === "string" ? { target: t } : t
      if (guard(tr.guard, event)) return take(event, tr, false)
    }
  }

  /**
   * Runs `fn`, drains the queue, notifies once if the snapshot changed — or if `force`
   * (a prop-driven value changed without changing the snapshot, so selectors re-read).
   */
  const batch = (fn: () => void, force = () => false) => {
    if (busy) return fn()
    busy = true
    const before = snap
    try {
      fn()
      for (let e = queue.shift(); e; e = queue.shift()) step(e)
    } finally {
      busy = false
      queue.length = 0
    }
    if (snap !== before || force()) for (const l of listeners) l()
  }

  const send = (event: Event) => {
    if (revoked) return
    batch(() => queue.push(event))
  }

  /** Queues `$sync` for every prop-driven key whose bound state differs from the state. */
  const sync = () => {
    for (const key in values) {
      if (!fromProps[key]) continue
      const v = value(key)
      const s = stateFor(key, v)
      if (s !== undefined && s !== snap.state) queue.push({ type: "$sync", key, value: v })
    }
  }

  /** The props diff: proposals met or refused, `$sync`, `onProps` events. */
  const applyProps = (prev: Props, next: Props) => {
    for (const key in values) {
      if (values[key]?.readOnly) continue
      if (fromProps[key] !== (next[key] !== undefined)) {
        if (process.env.NODE_ENV !== "production" && !warned.has(key)) {
          warned.add(key)
          console.warn(
            `[rind-ui] ${def.id}: "${key}" changed between controlled and uncontrolled; the first mode is kept.`,
          )
        }
        // Ignored: no proposal check and no $sync while the mode is mismatched.
        continue
      }
      if (!fromProps[key] || !(key in snap.proposed)) continue
      const proposed = snap.proposed[key]
      setProposed(key, NONE)
      if (!eq(key, proposed, value(key))) queue.push({ type: "$reverted", key, value: proposed })
    }
    sync()
    for (const key in def.onProps) {
      const type = def.onProps[key]
      if (type && !Object.is(prev[key], next[key])) queue.push({ type })
    }
  }

  type RawView = RawSnapshot & Record<string, unknown>
  let lastView: { snap: RawSnapshot; props: Props; view: RawView } | undefined

  const service = {
    machine,
    getSnapshot: () => snap,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    send,
    setProps(next: Props) {
      const prev = props
      const prevValues = resolved()
      props = next
      for (const key in values) {
        if (next[key] === undefined) continue
        lastProp[key] = next[key]
      }
      // A stopped service keeps the props but runs nothing; start() replays the diff
      // against the props it had when it stopped.
      if (revoked) return
      batch(
        () => applyProps(prev, next),
        () => {
          const now = resolved()
          return Object.keys(now).some((key) => !Object.is(now[key], prevValues[key]))
        },
      )
    },
    view(p: Props = props) {
      // Adapters pass a fresh props object per render: compare shallowly.
      if (lastView?.snap === snap && shallowEqual(lastView.props, p)) return lastView.view
      const s = snap
      const computed = {}
      const view: RawView = {
        ...s,
        values: resolved(p),
        computed,
        matches: (...states: string[]) => states.includes(s.state),
        hasTag: (tag: string) => def.states[s.state]?.tags?.includes(tag) ?? false,
      }
      for (const key in def.computed) {
        const fn = def.computed[key]
        Object.defineProperty(computed, key, {
          enumerable: true,
          configurable: true,
          get() {
            const v = fn?.(view)
            Object.defineProperty(computed, key, { value: v, enumerable: true })
            return v
          },
        })
      }
      lastView = { snap: s, props: p, view }
      return view
    },
    start() {
      if (started) return
      started = true
      revoked = false
      batch(() => {
        const sd = def.states[snap.state]
        if (!entered) {
          entered = true
          run(sd?.entry, { type: "$start" }, [])
        }
        rootCleanups = activate(def.effects, undefined)
        stateCleanups = activate(sd?.effects, sd)
        // Props applied while stopped (e.g. between StrictMode's stop and start).
        if (stoppedWith !== undefined && stoppedWith !== props) applyProps(stoppedWith, props)
        else sync()
        stoppedWith = undefined
      })
    },
    stop() {
      if (!started) return
      started = false
      revoked = true
      stoppedWith = props
      stateCleanups = cleanup(stateCleanups)
      rootCleanups = cleanup(rootCleanups)
    },
    inspect(listener: (step: Step) => void) {
      inspectors.add(listener)
      return () => inspectors.delete(listener)
    },
  }
  // The runtime works on the erased shape; the public `Service<M>` is the same object with
  // the names `M` carries.
  return service as unknown as Service<M>
}
