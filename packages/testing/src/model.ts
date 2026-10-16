import type { GenericInvariantId, Part } from "@rind-ui/core"
import {
  type AnyContract,
  type AnyMachine,
  type By,
  createService,
  type Env,
  type MachinePropsOf,
  type Modality,
  type PlatformFlags,
  platforms as platformPresets,
  type QuirkId,
  quirkActive,
  type RawImplementations,
  type RawMachineDef,
  type Step,
  withEngine,
} from "@rind-ui/core"
import type { AdapterEnv, Direction } from "./adapter"
import { installErrorLog } from "./adapters/dom"
import { isPage, watchPageErrors } from "./adapters/playwright"
import type { DomSnapshot, ElementInfo } from "./collect"
import { directed, runAction, type Target, toEnvFactory } from "./driver"
import { type GraphEdge, type MachineGraph, type Path, paths, toGraph } from "./graph"
import { checkGeneric, genericInvariants, type StepFacts } from "./invariants"

/** Contracts whose jsdom limitation was already reported in this run. */
const layoutNoted = new Set<string>()
const simulatedNoted = new Set<string>()

/** VoiceOver in Chrome on macOS: the Apple preset with the Blink engine. */
const appleBlink = withEngine(platformPresets.apple, "blink")

/** A consumer invariant: returns a failure message, or undefined when it holds. */
export interface ConsumerInvariant<C extends AnyContract> {
  readonly name: string
  readonly check: (ctx: {
    readonly env: Env<C["anatomy"][number]>
    readonly state: string
    readonly modality: Modality
    /** The props the instance was rendered with (the oracle's). */
    readonly props: Readonly<Record<string, unknown>>
    /** The oracle's resolved values after the step. */
    readonly values: Readonly<Record<string, unknown>>
  }) => Promise<string | undefined>
}

export interface TestMachineOptions<C extends AnyContract, R, A extends unknown[] = []> {
  /** Renders a fresh component; receives what the registrar passes (e.g. Playwright's page). */
  readonly setup: (...args: A) => R | Promise<R>
  /** What the driver runs against, given what `setup` returned. */
  readonly target: (rendered: R) => Target
  readonly anchor: Parameters<C["locate"]>
  /** The test registrar: Vitest `it`, Jest `test`, or a Playwright wrapper. */
  readonly test: (name: string, fn: (...args: A) => Promise<void>) => void
  /**
   * Props the component receives, so the oracle evaluates guards the same way. Every prop
   * a guard reads must be listed (undefined is fine); the runner fails otherwise.
   */
  readonly props?: MachinePropsOf<C["machine"]>
  /** Re-renders with new props: needed to walk `$sync` / `$props` edges (prop steps). */
  readonly rerender?: (props: MachinePropsOf<C["machine"]>, rendered: R) => unknown
  readonly coverage?: "states" | "transitions"
  /** Default: every modality some action declares, plus `virtual` for pointer actions. */
  readonly modalities?: readonly Modality[]
  /** Default: ["ltr"], or both when the contract declares `directional`. */
  readonly directions?: readonly Direction[]
  /** Added to the generic and per-contract invariants; cannot turn those off. */
  readonly invariants?: readonly ConsumerInvariant<C>[]
  /** Accessibility checker (e.g. axe), run once per distinct state reached in a test. */
  readonly a11y?: (target: Target) => Promise<void>
  /**
   * Platforms to run as (render with `currentRun().platform`). Default: Linux, or Apple and
   * Windows for `composite-activedescendant` (announcement parity).
   */
  readonly platforms?: readonly PlatformFlags[]
  /** The locale the component renders with (read it in `setup` with `currentRun()`). */
  readonly locale?: string
  /**
   * Activation parity for steps that stay in the same state (a Button's PRESS): `action` is
   * the machine action that calls the consumer's callback, `count` how many times the
   * test's spy ran. Each action step must call it exactly as often as the oracle's step runs
   * that action (AT 12: one bare click, one activation).
   */
  readonly activations?: { readonly action: string; readonly count: () => number }
}

/** What the current `testMachine` run emulates, for `setup` to render accordingly. */
export interface RunContext {
  readonly platform: PlatformFlags
  readonly locale: string
  readonly direction: Direction
  readonly modality: Modality
  /** Reopen-during-exit checks across this testMachine's paths (presence contracts). */
  readonly reopen?: { exercised: number; skipped: number } | undefined
}
let run: RunContext | undefined
/** The run `setup` is rendering for (platform, locale, direction, modality). */
export const currentRun = (): RunContext | undefined => run

export interface MachinePath {
  readonly name: string
  readonly edges: Path
}

type Props = Record<string, unknown>

/** How the runner takes an edge. */
type Mapping =
  | {
      readonly kind: "action"
      readonly action: string
      readonly args?: (view: unknown) => readonly unknown[]
      readonly event?: ((view: unknown) => Readonly<Record<string, unknown>>) | undefined
    }
  | { readonly kind: "props"; readonly props: (target: string) => Props }
  | { readonly kind: "delay" }
  | { readonly kind: "skip"; readonly reason: string }

function mappingOf(contract: AnyContract, edge: GraphEdge): Mapping | undefined {
  if (edge.event.startsWith("after:")) return { kind: "delay" }
  // Contract events are typed per machine; read here through their runtime shapes.
  const declared = contract.events[edge.event] as
    | { readonly from: Readonly<Record<string, unknown>> }
    | Record<string, unknown>
    | string
    | undefined
  // A per-state mapping resolves to the one for this edge's source state.
  const picked =
    typeof declared === "object" && "from" in declared
      ? (declared.from as Readonly<Record<string, unknown>>)[edge.source]
      : declared
  const m = picked as
    | string
    | { readonly skip: string }
    | { readonly props: (target: string) => Props }
    | {
        readonly action: string
        readonly args?: (view: unknown) => readonly unknown[]
        readonly event?: (view: unknown) => Readonly<Record<string, unknown>>
      }
    | undefined
  if (m === undefined) return undefined
  if (typeof m === "string") return { kind: "action", action: m }
  if ("skip" in m) return { kind: "skip", reason: m.skip }
  if ("props" in m) return { kind: "props", props: m.props }
  return {
    kind: "action",
    action: m.action,
    ...(m.args ? { args: m.args } : {}),
    event: m.event,
  }
}

const walkable = (contract: AnyContract, canRerender: boolean) => (edge: GraphEdge) => {
  const m = mappingOf(contract, edge)
  return m !== undefined && m.kind !== "skip" && (m.kind !== "props" || canRerender)
}

const guardText = (g: GraphEdge["guard"]): string =>
  g === null
    ? ""
    : typeof g === "string"
      ? g
      : "not" in g
        ? `!${guardText(g.not)}`
        : "and" in g
          ? g.and.map(guardText).join(" && ")
          : g.or.map(guardText).join(" || ")

const edgeLabel = (e: GraphEdge) =>
  `—${e.event}${e.guard ? `[${guardText(e.guard)}]` : ""}→ ${e.target ?? e.source}`

/** `closed —OPEN→ open —ESCAPE[closeOnEscape]→ closed`. */
const label = (edges: Path) =>
  edges.reduce((out, e) => `${out} ${edgeLabel(e)}`, edges[0]?.source ?? "")

/** The paths `testMachine` walks, for custom runners and for printing. */
export function machinePaths(
  contract: AnyContract,
  coverage: "states" | "transitions" = "transitions",
  graph: MachineGraph = toGraph(contract.machine),
  canRerender = true,
): readonly MachinePath[] {
  return paths(graph, { cover: coverage, walkable: walkable(contract, canRerender) }).map(
    (edges) => ({ name: label(edges), edges }),
  )
}

const modalitiesOf = (action: object): Modality[] => {
  const out = (["pointer", "keyboard", "touch"] as const).filter((m) => m in action)
  return "pointer" in action ? [...out, "virtual"] : out
}

/** The modality a step runs in: the path's, or the action's keyboard twin, then pointer. */
/** The item count of a `collection` prop (a rind-ui Collection has a numeric `size`). */
const collectionSizeOf = (props: unknown): { collectionSize?: number } => {
  const c = (props as { collection?: { size?: unknown } } | null)?.collection
  return typeof c?.size === "number" ? { collectionSize: c.size } : {}
}

const stepModality = (action: object, modality: Modality): Modality => {
  const own = modalitiesOf(action)
  if (own.includes(modality)) return modality
  return (["keyboard", "pointer", "touch"] as const).find((m) => own.includes(m)) ?? modality
}

/**
 * What the contract expects of each part element in `state`: data-state (one value for every
 * non-item part, or per part) and ARIA attributes, functions resolved against the oracle's
 * view and the element's attributes.
 */
function expectations(
  contract: AnyContract,
  state: string,
  view: unknown,
): Pick<StepFacts, "expected" | "open"> {
  const ds = contract.dataState?.[state]
  const attrs = contract.attrs?.[state]
  const resolve = (x: unknown, el: ElementInfo) =>
    typeof x === "function" ? (x as (v: unknown, a: unknown) => unknown)(view, el.attrs) : x
  const open =
    ds === undefined
      ? state === "open"
      : typeof ds === "string"
        ? ds === "open"
        : Object.values(ds).includes("open")
  return {
    open,
    expected: (el) => {
      if (el.part === null) return {}
      const dataState =
        ds === undefined
          ? undefined
          : typeof ds === "string"
            ? el.part === "item"
              ? undefined
              : ds
            : (resolve(ds[el.part], el) as string | undefined)
      const own = attrs?.[el.part]
      return {
        dataState,
        attrs: own === undefined ? undefined : (resolve(own, el) as Record<string, string | null>),
      }
    },
  }
}

/** The event type the oracle processes for an edge (`$props:x` → the declared event). */
function stepEvent(machine: AnyMachine, edge: GraphEdge): string {
  if (edge.event.startsWith("$sync:")) return "$sync"
  if (edge.event.startsWith("$props:")) {
    // Every machine's definition has the raw shape; the typed one refines it.
    return (machine.def as RawMachineDef).onProps?.[edge.event.slice(7)] ?? edge.event
  }
  return edge.event
}

/** Whether the oracle's step log shows that this edge was taken. */
const taken = (edge: GraphEdge, type: string, log: readonly Step[]) =>
  log.some((s) => s.event.type === type && s.source === edge.source && s.target === edge.target)

/**
 * An oracle: the contract's pure machine with the given props, never started (no effects,
 * no timers; delays are sent as `after:<delay>` events). Guards read props through a proxy
 * that records which ones they read.
 */
/**
 * The oracle's environment: a real clock (typeahead timeouts agree with the page's), the
 * default locale, nothing to measure, focus or announce.
 */
const oracleEnv = {
  clock: { now: () => globalThis.performance?.now() ?? Date.now() },
  locale: { locale: () => new Intl.Collator().resolvedOptions().locale, dir: () => "ltr" },
  platform: {
    engine: "blink",
    apple: false,
    mac: false,
    ios: false,
    android: false,
    windows: false,
    webkit: false,
    chromium: true,
    firefox: false,
  },
  layout: { pageTarget: () => null },
  dom: { getById: () => null, activeElement: () => null, getRootNode: () => undefined },
  announcer: { announce: () => {}, prepare: () => () => {}, cancel: () => {} },
  // A cold delay group: one instance under test, never warmed by another.
  delayGroup: {
    join: () => () => {},
    isWarm: () => false,
    opened: () => {},
    closed: () => {},
  },
  modality: {
    modality: () => "keyboard",
    subscribe: () => () => {},
    focusCause: () => "other",
    markFocus: () => {},
    unmarkFocus: () => {},
    recentFocus: () => [],
  },
}

function createOracle(contract: AnyContract, initial: Props) {
  const reads = new Set<string>()
  let inGuard = false
  // Implementations have the raw shape at runtime; only guards are wrapped.
  const impl = contract.machine.impl as RawImplementations
  const guards = Object.fromEntries(
    Object.entries(impl.guards ?? {}).map(([name, guard]) => [
      name,
      (args: Parameters<typeof guard>[0]) => {
        inGuard = true
        try {
          return guard(args)
        } finally {
          inGuard = false
        }
      },
    ]),
  )
  const track = (p: Props) =>
    new Proxy(p, {
      get(target, key) {
        if (inGuard && typeof key === "string") reads.add(key)
        return Reflect.get(target, key)
      },
    })
  const machine = { ...contract.machine, impl: { ...impl, guards } }
  // The oracle never starts (no effects); actions that reach the environment (a clock for
  // typeahead, page layout, focus and announcements) get an inert one.
  const service = createService(machine as AnyMachine, track(initial) as never, oracleEnv as never)
  const log: Step[] = []
  service.inspect((s) => log.push(s))
  let props = initial
  return {
    service,
    log,
    reads,
    get props() {
      return props
    },
    setProps(next: Props) {
      props = next
      service.setProps(track(next) as never)
    },
    send(type: string, extra: Record<string, unknown> = {}) {
      service.send({ type, ...extra } as never)
    },
  }
}

interface Planned {
  readonly path: MachinePath
  /** The first edge the oracle does not take under the given props (path cut before it). */
  readonly notTaken: GraphEdge | null
}

/**
 * Walks a path on an oracle, with each action step in the modality the runner will use (so
 * guards reading the modality decide as they will at run time): cuts it at the first edge
 * these props and this modality do not take.
 */
function plan(
  contract: AnyContract,
  path: MachinePath,
  props: Props,
  reads: Set<string>,
  modality: Modality,
): Planned {
  const oracle = createOracle(contract, props)
  const actions = contract.actions as Record<string, object | undefined>
  for (const [i, edge] of path.edges.entries()) {
    const m = mappingOf(contract, edge)
    const before = oracle.log.length
    const action = m?.kind === "action" ? actions[m.action] : undefined
    if (m?.kind === "props")
      oracle.setProps({ ...oracle.props, ...m.props(edge.target ?? edge.source) })
    else if (action && m?.kind === "action") {
      const payload = m.event?.(oracle.service.view()) ?? {}
      oracle.send(edge.event, { ...payload, modality: stepModality(action, modality) })
    } else oracle.send(edge.event)
    if (!taken(edge, stepEvent(contract.machine, edge), oracle.log.slice(before))) {
      for (const r of oracle.reads) reads.add(r)
      // Kept as the last step: the runner checks the component stays where the oracle
      // does (the guard decides), but the edge is reported as not taken, not covered.
      const edges = path.edges.slice(0, i + 1)
      return { path: { name: `${label(edges)} (not taken)`, edges }, notTaken: edge }
    }
  }
  for (const r of oracle.reads) reads.add(r)
  return { path, notTaken: null }
}

/**
 * Registers one test per path × modality (× direction) that walks the machine graph
 * through the contract, comparing the component against a headless copy of the machine
 * and checking every applicable invariant after each step, plus one coverage test that
 * fails while an event or prop edge has no mapping.
 */
export function testMachine<const C extends AnyContract, R, A extends unknown[] = []>(
  contract: C,
  options: TestMachineOptions<C, R, A>,
): void {
  const graph = toGraph(contract.machine)
  const props = (options.props ?? {}) as Props
  const canRerender = options.rerender !== undefined
  const reads = new Set<string>()
  const actions = contract.actions as Record<string, object | undefined>
  const modalities = options.modalities ?? [
    ...new Set(Object.values(actions).flatMap((a) => (a ? modalitiesOf(a) : []))),
  ]
  // Plan on the oracle, per modality, then re-plan without the edges these props and this
  // modality never take, so a path to an edge does not go through one the component cannot
  // take (a refused toggle in a controlled run, a keyboard-only branch in a pointer run) —
  // until nothing new is excluded.
  const planFor = (modality: Modality): Planned[] => {
    const excluded = new Set<GraphEdge>()
    /** The first path that reached each not-taken edge (it ends with that edge). */
    const cut: Planned[] = []
    let planned: Planned[] = []
    for (let round = 0; round <= graph.edges.length; round++) {
      const isWalkable = walkable(contract, canRerender)
      planned = paths(graph, {
        cover: options.coverage ?? "transitions",
        walkable: (e) => isWalkable(e) && !excluded.has(e),
      }).map((edges) => plan(contract, { name: label(edges), edges }, props, reads, modality))
      const before = excluded.size
      for (const p of planned) {
        if (p.notTaken && !excluded.has(p.notTaken)) {
          excluded.add(p.notTaken)
          cut.push(p)
        }
      }
      if (excluded.size === before) break
    }
    return [...planned.filter((p) => !p.notTaken), ...cut]
  }
  const plannedBy = new Map(modalities.map((m) => [m, planFor(m)] as const))
  const directions =
    options.directions ?? (contract.traits.includes("directional") ? ["ltr", "rtl"] : ["ltr"])
  const runPlatforms =
    options.platforms ??
    (contract.traits.includes("composite-activedescendant")
      ? // VoiceOver differs between Safari and Chrome (vo-activedescendant), then Windows.
        [platformPresets.apple, appleBlink, platformPresets.windows]
      : [platformPresets.linux])
  const platformName = (p: PlatformFlags) =>
    Object.entries(platformPresets).find(([, preset]) => preset === p)?.[0] ??
    `${p.ios ? "ios" : p.apple ? "apple" : p.windows ? "windows" : p.android ? "android" : "other"}-${p.engine}`

  const missingProps = [...reads].filter((key) => !(key in props))
  if (missingProps.length > 0) {
    options.test(`${contract.scope}: props read by guards`, async (..._: A) => {
      throw new Error(
        missingProps
          .map((key) => `a guard reads prop "${key}": pass it in testMachine({ props })`)
          .join("\n"),
      )
    })
  }

  const reopenStats = { exercised: 0, skipped: 0 }
  const covered = new Set<GraphEdge>()
  /** Edges cut as not taken in some modality (reported only if no modality covers them). */
  const notTaken = new Set<GraphEdge>()
  modalities.forEach((modality, index) => {
    const seen = new Set<string>()
    for (const plannedPath of plannedBy.get(modality) ?? []) {
      const { path, notTaken: skipped } = plannedPath
      if (skipped) notTaken.add(skipped)
      if (path.edges.length === 0 || seen.has(path.name)) continue
      seen.add(path.name)
      const steps = path.edges.map((e) => mappingOf(contract, e))
      const hasActions = steps.some((m) => m?.kind === "action")
      const native = steps.some((m) => {
        const action = m?.kind === "action" ? actions[m.action] : undefined
        return action !== undefined && modalitiesOf(action).includes(modality)
      })
      // A path without actions (only delays or prop steps) runs once, in the first modality.
      if (!native && (hasActions || index > 0)) continue
      for (const e of path.edges) if (e !== skipped) covered.add(e)
      for (const direction of directions) {
        for (const platform of runPlatforms) {
          const tags = [
            modality,
            ...(direction === "rtl" ? ["rtl"] : []),
            ...(runPlatforms.length > 1 ? [platformName(platform)] : []),
          ]
          const name = `${contract.scope} [${tags.join(", ")}]: ${path.name}`
          const ctx: RunContext = {
            platform,
            locale: options.locale ?? "en",
            direction,
            modality,
            reopen: reopenStats,
          }
          options.test(name, (...args: A) =>
            runPath(contract, graph, plannedPath, ctx, options, args, name),
          )
        }
      }
    }
  })

  // The reopen-during-exit check must have run at least once when the content animates: an
  // exit that always ended before the hold would otherwise pass vacuously.
  if (contract.traits.includes("presence")) {
    options.test(`${contract.scope}: presence — reopen during exit exercised`, async (..._: A) => {
      console.info(
        `[rind-ui] ${contract.scope} presence: reopen during exit exercised ${reopenStats.exercised}, exit over before the hold ${reopenStats.skipped}`,
      )
      if (reopenStats.exercised === 0 && reopenStats.skipped > 0) {
        throw new Error(
          `${contract.scope}: reopen-during-exit never exercised: exit ended before hold (${reopenStats.skipped} closing steps)`,
        )
      }
    })
  }

  // Reported explicitly, never skipped silently.
  const failing: string[] = []
  const info: string[] = []
  for (const edge of graph.edges) {
    if (covered.has(edge)) continue
    const where = `${edge.source} ${edgeLabel(edge)}`
    const m = mappingOf(contract, edge)
    if (edge.event === "$reverted") info.push(`${where} (from the parent)`)
    else if (m?.kind === "skip") info.push(`${where} (skipped: ${m.reason})`)
    else if (notTaken.has(edge)) info.push(`${where} (not taken under these props)`)
    else if (m?.kind === "props" && !canRerender) info.push(`${where} (needs rerender)`)
    else if (m === undefined) failing.push(`${where} (no mapping)`)
    else info.push(`${where} (unreachable)`)
  }
  if (failing.length > 0 || info.length > 0) {
    const name = `${contract.scope}: coverage — ${failing.length} uncovered, ${info.length} reported`
    options.test(name, async (..._: A) => {
      // Shown on every run, so CI output says what was not exercised and why.
      for (const line of info) console.info(`[rind-ui] ${contract.scope} coverage: ${line}`)
      if (failing.length > 0) {
        throw new Error(
          [
            `${contract.scope}: edges with no contract mapping (map them, or { skip: "reason" }):`,
            ...failing.map((f) => `- ${f}`),
            ...(info.length > 0 ? ["reported:", ...info.map((f) => `- ${f}`)] : []),
          ].join("\n"),
        )
      }
    })
  }
}

const TEXT_ENTRY = new Set(["textbox", "combobox", "searchbox", "spinbutton"])
const IME_KEYS = new Set([
  "Enter",
  "Escape",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
])

/** Keys an IME may swallow: navigation/commit keys and every printable character. */
const imeKey = (key: string) => IME_KEYS.has(key) || [...key].length === 1

type ActionImpl = (env: Env, ...args: unknown[]) => Promise<unknown>

/**
 * An env that replays an action differently: hover as touch, or keys as composing on
 * text-entry parts; every other input is dropped. `used` tells whether anything was replayed.
 */
function replayEnv(base: AdapterEnv, snapshot: DomSnapshot, mode: "touch-hover" | "composing") {
  const state = { used: false, keys: [] as string[], finish: [] as (() => Promise<void>)[] }
  const isText = (name: string | null) =>
    TEXT_ENTRY.has(snapshot.parts.find((p) => p.part === name)?.role ?? "")
  const wrap = (part: Part, name: string | null): Part => ({
    ...part,
    click: async () => {},
    tap: async () => {},
    focus: async () => {},
    focusWithTab: async () => {},
    // Typed text replays as an IME composition that is then cancelled: while composing,
    // printable characters (typeahead, tag delimiters) must not commit anything.
    type: async (text) => {
      if (mode !== "composing" || !isText(name) || text === "") return
      state.used = true
      state.keys.push(JSON.stringify(text))
      const updates = [...text].map((_, i) => text.slice(0, i + 1))
      // Left open: the runner observes while composing, then cancels (`finish`).
      await part.compose(updates)
      state.finish.push(() => part.compose([], ""))
    },
    compose: async () => {},
    pressAtPosition: async () => {},
    pointer: async () => {},
    fill: async () => {},
    hover: async () => {
      if (mode !== "touch-hover") return
      state.used = true
      await part.hover({ pointerType: "touch" })
    },
    press: async (key, o) => {
      if (mode !== "composing" || !imeKey(key) || !isText(name)) return
      state.used = true
      state.keys.push(key)
      await part.press(key, { ...o, composing: true })
    },
    nth: (i) => wrap(part.nth(i), name),
    all: async () => (await part.all()).map((p) => wrap(p, name)),
    // Parts reached through another part (a group's items) are replayed the same way.
    // (`labelled()` stays the real part: the Field contract's typing replays through it.)
    scoped: (scope, inner) => wrap(part.scoped(scope, inner), null),
    withAttr: (name, value) => wrap(part.withAttr(name, value), null),
  })
  const env: AdapterEnv = {
    ...base,
    part: (name, by) => wrap(base.part(name, by), name),
    find: (by) => wrap(base.find(by), null),
    focused: () => wrap(base.focused(), snapshot.focus.part),
    keyboard: async (key, o) => {
      if (
        mode !== "composing" ||
        !imeKey(key) ||
        !TEXT_ENTRY.has(snapshot.focus.element?.role ?? "")
      )
        return
      state.used = true
      state.keys.push(key)
      await base.keyboard(key, { ...o, composing: true })
    },
    pointerOutside: async () => {},
  }
  return { env, state }
}

async function runPath<C extends AnyContract, R, A extends unknown[]>(
  contract: C,
  graph: MachineGraph,
  { path, notTaken }: Planned,
  ctx: RunContext,
  options: TestMachineOptions<C, R, A>,
  args: A,
  testName: string,
): Promise<void> {
  const { modality, direction, platform } = ctx
  // Errors logged between tests must not land in this one; listeners go on before setup()
  // so errors during the first render are caught (DOM window, or a Playwright page arg).
  installErrorLog().splice(0)
  for (const arg of args) if (isPage(arg)) watchPageErrors(arg).splice(0)
  run = ctx
  const rendered = await options.setup(...args)
  const target = options.target(rendered)
  const factory = toEnvFactory(target)
  // `locate` takes exactly the anchor arguments the options declare.
  const anchor = (contract.locate as (...a: unknown[]) => By)(
    ...(options.anchor as readonly unknown[]),
  )
  const envs = new Map<Modality, AdapterEnv>()
  const envFor = (m: Modality) => {
    let env = envs.get(m)
    if (!env) {
      env = directed(
        factory.create({ scope: contract.scope, anchor, modality: m, platform }),
        direction,
      )
      envs.set(m, env)
    }
    return env
  }
  const base = envFor(modality)
  if (direction === "rtl") await base.setDirection("rtl")

  const props = (options.props ?? {}) as Props
  const oracle = createOracle(contract, props)
  /** Everything sent to the oracle, to replay "what if" events on a copy. */
  const inputs: (
    | { kind: "send"; type: string; extra: Record<string, unknown> }
    | { kind: "props"; props: Props }
  )[] = []
  const send = (type: string, extra: Record<string, unknown> = {}) => {
    inputs.push({ kind: "send", type, extra })
    oracle.send(type, extra)
  }
  /** The oracle's state after the inputs so far plus `extra` (on a fresh copy). */
  const whatIf = (type: string, extra: Record<string, unknown>) => {
    const copy = createOracle(contract, props)
    for (const input of inputs) {
      if (input.kind === "send") copy.send(input.type, input.extra)
      else copy.setProps(input.props)
    }
    copy.send(type, extra)
    return copy.service.getSnapshot().state
  }
  const impl = contract.machine.impl as RawImplementations
  const hasFocusEvent = graph.edges.some((e) => e.event === "FOCUS")
  // jsdom has no `inert` behaviour: say what the modal checks did not exercise, once.
  if (
    contract.traits.includes("modal") &&
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("jsdom") &&
    !simulatedNoted.has(contract.scope)
  ) {
    simulatedNoted.add(contract.scope)
    console.info(
      `[rind-ui] ${contract.scope}: modal checks verified the inert attributes and scroll-lock styles only; inert behaviour (focus and pointer blocking) is verified in a real browser`,
    )
  }
  // Without layout the anchored geometry checks cannot run: say so, once.
  if (
    contract.traits.includes("anchored") &&
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("jsdom") &&
    !layoutNoted.has(contract.scope)
  ) {
    layoutNoted.add(contract.scope)
    console.info(
      `[rind-ui] ${contract.scope}: anchored layout checks unexercised (no layout in jsdom); placement before focus was checked`,
    )
  }
  const reached = new Set<string>()
  const done: string[] = [graph.initial]
  let skippedChromium = false
  const exceptions = (contract.exceptions ?? []).filter((e) =>
    // Exceptions reference registry ids (checked by the contract's types).
    quirkActive(e.quirk as QuirkId, { platform }),
  )
  if (exceptions.length > 0) {
    for (const e of exceptions) {
      console.info(
        `[rind-ui] ${contract.scope}: exception ${e.invariant} for ${e.part} (quirk ${e.quirk})`,
      )
    }
  }
  const exempt = (invariant: GenericInvariantId, part: string) =>
    exceptions.some((e) => e.invariant === invariant && e.part === part)

  const fail = (step: number, edge: GraphEdge | null, message: string): never => {
    const steps = oracle.log.map(
      (s) =>
        `${s.source} —${s.event.type}→ ${s.target ?? s.source}${s.actions.length > 0 ? ` (${s.actions.join(", ")})` : ""}`,
    )
    throw new Error(
      [
        `${testName}`,
        `  failed ${edge ? `at step ${step}/${path.edges.length} (—${edge.event}→)` : "in the initial state"}`,
        `  modality: ${modality}${direction === "rtl" ? ", rtl" : ""}`,
        `  path so far: ${done.join(" → ")}`,
        `  oracle steps: ${steps.length > 0 ? steps.join("; ") : "none"}`,
        `  ${message.split("\n").join("\n  ")}`,
      ].join("\n"),
    )
  }

  /** Every query, each caught on its own so one throwing query keeps the report readable. */
  const observe = async () => {
    const out: Record<string, unknown> = {}
    for (const [name, query] of Object.entries(contract.queries)) {
      // A query with arguments has no single reading.
      if (query.length > 1) continue
      out[name] = await (query as (env: Env) => Promise<unknown>)(base).catch(
        (e: unknown) => `<${e instanceof Error ? e.message : String(e)}>`,
      )
    }
    return out
  }
  const expectedFor = (state: string) => (contract.states[state] ?? {}) as Record<string, unknown>
  const matchesState = (state: string) => (seen: Record<string, unknown>) =>
    Object.entries(expectedFor(state)).every(([k, v]) => Object.is(seen[k], v))
  /** The longest delay the machine can schedule under the current props. */
  const longestDelay = () =>
    Math.max(
      0,
      ...Object.values(impl.delays ?? {}).map((d) => {
        try {
          return Number(d({ props: oracle.props })) || 0
        } catch {
          return 0
        }
      }),
    )
  /**
   * After a replay that must change nothing: every query still reads what it read before,
   * and the component still shows `state` — also after the machine's longest delay, so a
   * delayed reaction (a tooltip's open delay) is seen.
   */
  const unchanged = async (state: string, previous: Record<string, unknown>, wait = 16) => {
    await base.advance(wait)
    const seen = await observe()
    const changed = Object.keys(seen).filter(
      (k) => JSON.stringify(seen[k]) !== JSON.stringify(previous[k]),
    )
    return { ok: matchesState(state)(seen) && changed.length === 0, seen, changed }
  }
  const hoveredParts = async () =>
    new Set(
      (await base.collect()).parts
        .filter((p) => p.attrs["data-hover"] !== undefined)
        .map((p) => p.describe),
    )

  /** The last step's facts: the base of the unmount-while-open check. */
  /** Steps whose user action changed the value (form-associated: one `change` each). */
  let userChanges = 0
  let lastFacts: StepFacts | null = null
  const verify = async (
    step: number,
    edge: GraphEdge | null,
    before: DomSnapshot | null,
    from: string | null,
    baseline: DomSnapshot | null,
    stepModality: Modality | null,
    announcedBefore: number,
  ) => {
    const state = oracle.service.getSnapshot().state
    const expected = expectedFor(state)
    const matches = matchesState(state)
    const seen = await base.until(observe, matches).catch(async () => observe())
    if (!matches(seen)) {
      // A bare click must reach the oracle's state with exactly one activation (AT 12).
      const prefix = stepModality === "virtual" ? "virtual-parity: " : ""
      fail(
        step,
        edge,
        `${prefix}expected ${state}: ${JSON.stringify(expected)}\n  observed: ${JSON.stringify(seen)}`,
      )
    }
    if (contract.traits.includes("timed") && seen["isOpen"] === true) {
      // WCAG 1.4.13 persistent: while a part is hovered or focused, no pending delay may
      // hide it. Every delay is waited out, then it must still be open.
      const parts = (await base.collect()).parts
      const held = parts.filter(
        (p) => p.attrs["data-hover"] !== undefined || p.attrs["data-focus"] !== undefined,
      )
      if (held.length > 0) {
        await base.advance(longestDelay() + 16)
        const after = await observe()
        if (after["isOpen"] !== true) {
          fail(
            step,
            edge,
            `timed: closed by a timer while ${held.map((p) => p.describe).join(", ")} ${held.length === 1 ? "is" : "are"} hovered or focused (waited ${longestDelay() + 16} ms)`,
          )
        }
      }
    }
    if (contract.traits.includes("presence")) {
      // Closed content is removed once its exit animations end: wait for that first.
      const content = contract.semantics?.["content"]
      await base
        .until(
          async () =>
            (await base.collect()).parts.filter((p) => p.part === content && p.animations > 0)
              .length,
          (n) => n === 0,
        )
        .catch(() => {})
      await base.advance(16)
    }
    const after = await base.collect()
    const facts: StepFacts = {
      before,
      after,
      baseline: baseline ?? after,
      from,
      state,
      ...expectations(contract, state, oracle.service.view()),
      atInitial: state === graph.initial,
      anchorCount: await base.anchorCount(),
      errors: await base.takeErrors(),
      traits: contract.traits,
      semantics: { ...contract.semantics },
      values: oracle.service.view().values as Record<string, unknown>,
      context: oracle.service.getSnapshot().context as Record<string, unknown>,
      ...collectionSizeOf(oracle.props),
      modality: stepModality,
      platform,
      stepAnnouncements: (await base.announcements()).slice(announcedBefore),
      observed: seen,
      ...(contract.announcements ? { announcements: contract.announcements } : {}),
      ...(contract.valued
        ? {
            valued: {
              values: contract.valued.values(oracle.service.view()),
              ...(contract.valued.valueText
                ? {
                    valueText: (i: number) =>
                      contract.valued?.valueText?.(oracle.service.view(), i) ?? "",
                  }
                : {}),
            },
          }
        : {}),
      ...(contract.formInput
        ? {
            formInput: {
              ...(contract.formInput.multiple ? { multiple: true } : {}),
              ...(contract.formInput.accessible ? { accessible: true } : {}),
              expected: (input: { readonly value: string; readonly index: number }) =>
                contract.formInput?.expected(
                  oracle.service.view().values as Record<string, unknown>,
                  input,
                ) ?? {},
              userChanges,
            },
          }
        : {}),
      exempt,
    }
    lastFacts = facts
    const problems = [...checkGeneric(facts)]
    // Chromium's own tree (Playwright in Chromium): where screen readers follow the browser.
    const chromium = await base.chromiumChecks?.()
    if (chromium === "unavailable") {
      if (!skippedChromium) {
        skippedChromium = true
        console.info(
          `[rind-ui] ${contract.scope}: Chromium accessibility-tree checks skipped (unavailable here)`,
        )
      }
    } else if (chromium) {
      problems.push(...chromium.map((p) => `chromium-tree: ${p}`))
    }
    // Contract invariants are typed on the contract's own parts and states; at runtime they
    // take the same context consumer invariants do.
    const own = [
      ...(contract.invariants ?? []),
      ...(options.invariants ?? []),
    ] as unknown as readonly {
      readonly name: string
      readonly check: (ctx: {
        env: Env
        state: string
        modality: Modality
        props: Readonly<Record<string, unknown>>
        values: Readonly<Record<string, unknown>>
      }) => Promise<unknown>
    }[]
    for (const inv of own) {
      const result = await inv
        .check({
          env: base,
          state,
          modality,
          props: oracle.props as Record<string, unknown>,
          values: oracle.service.view().values as Record<string, unknown>,
        })
        .catch((e: unknown) => (e instanceof Error ? e.message : String(e)))
      if (typeof result === "string" && result !== "") problems.push(`${inv.name}: ${result}`)
    }
    if (problems.length > 0) {
      fail(step, edge, `invariants failed in ${state}:\n- ${problems.join("\n- ")}`)
    }
    if (options.a11y && !reached.has(state)) {
      reached.add(state)
      await options
        .a11y(target)
        .catch((e: unknown) =>
          fail(
            step,
            edge,
            `accessibility check failed in ${state}:\n${e instanceof Error ? e.message : String(e)}`,
          ),
        )
    }
    return after
  }

  /** Replays an action as touch hover / composing keys; it must change nothing. */
  const replay = async (
    step: number,
    edge: GraphEdge,
    mode: "touch-hover" | "composing",
    impl: ActionImpl,
    actionArgs: readonly unknown[],
    snapshot: DomSnapshot,
    state: string,
  ) => {
    const { env, state: used } = replayEnv(
      envFor(mode === "composing" ? "keyboard" : "touch"),
      snapshot,
      mode,
    )
    const previous = await observe()
    const hoveredBefore = await hoveredParts()
    await impl(env, ...actionArgs).catch(() => {})
    if (!used.used) return
    const transition = `${state} —${edge.event}→ ${edge.target ?? state}`
    // Waiting out the machine's delays shows a delayed reaction (a tooltip's open delay) —
    // unless this state runs a timer of its own, whose effect is legitimate.
    const ownTimer = graph.edges.some((e) => e.source === state && e.event.startsWith("after:"))
    const wait = 16 + (ownTimer ? 0 : longestDelay())
    const { ok, seen, changed } = await unchanged(state, previous, wait)
    const what = `changed ${changed.length > 0 ? changed.join(", ") : "the state"}: expected ${state} ${JSON.stringify(expectedFor(state))}, observed ${JSON.stringify(seen)}`
    // Ends what the replay left open (an IME composition), after the observation.
    for (const finish of used.finish) await finish()
    if (used.finish.length > 0) await base.advance(16)
    if (mode === "touch-hover") {
      // Only parts that GAINED data-hover: an earlier mouse hover may legitimately remain.
      const gained = [...(await hoveredParts())].filter((d) => !hoveredBefore.has(d))
      if (!ok || gained.length > 0) {
        fail(
          step,
          edge,
          `no-touch-hover: a touch "hover" in the action of ${transition} ${gained.length > 0 ? `set data-hover on ${gained.join(", ")}` : what}`,
        )
      }
    }
    if (mode === "composing" && !ok) {
      fail(
        step,
        edge,
        `ime-never-commits: composing ${used.keys.join(", ")} in the action of ${transition} ${what}`,
      )
    }
  }

  /**
   * Presence, after a closing action: sampled mid-exit (a running exit animation), then
   * reopened — the exiting element must come back, not a new one — and closed again by the
   * same action, so the path goes on from the state it reached.
   */
  const reopenDuringExit = async (
    step: number,
    edge: GraphEdge,
    close: { readonly action: string; readonly args: readonly unknown[]; readonly mod: Modality },
    held: { readonly resume: () => Promise<void>; readonly animatedBefore: boolean },
  ) => {
    const { resume } = held
    const content = contract.semantics?.["content"]
    const exiting = (await base.collect()).parts.find((p) => p.part === content && p.animations > 0)
    if (!exiting) {
      // The content animates (computed style) but its exit was over before the hold: counted,
      // so a run where this always happens fails instead of passing vacuously.
      if (held.animatedBefore && ctx.reopen) ctx.reopen.skipped += 1
      await resume()
      return
    }
    if (ctx.reopen) ctx.reopen.exercised += 1
    if (exiting.attrs["data-state"] !== "closed") {
      fail(
        step,
        edge,
        `presence: ${exiting.describe} is exiting (running animations: ${exiting.animations}) without data-state="closed"`,
      )
    }
    const state = oracle.service.getSnapshot().state
    const reopen = graph.edges.find(
      (e) =>
        e.source === state &&
        e.target !== null &&
        expectations(contract, e.target, null).open &&
        mappingOf(contract, e)?.kind === "action",
    )
    const m = reopen ? mappingOf(contract, reopen) : undefined
    if (!reopen || m?.kind !== "action") {
      await resume()
      return
    }
    const action =
      (contract.actions as Record<string, Record<string, unknown> | undefined>)[m.action] ?? {}
    // By keyboard when the action has one: a pointer waits until the exiting backdrop that
    // covers the trigger is gone, which is after the exit.
    const mod = stepModality(action, "keyboard")
    const act = async (name: string, args: readonly unknown[], m: Modality) => {
      try {
        await runAction(contract, envFor(m), name, args, false)
      } catch (e) {
        fail(
          step,
          edge,
          `presence (reopen during the exit): ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
    send(reopen.event, { modality: mod })
    await act(m.action, m.args?.(oracle.service.view()) ?? [], mod)
    const back = (await base.collect()).parts.find((p) => p.part === content)
    await resume()
    if (back?.node !== exiting.node) {
      fail(
        step,
        edge,
        `presence: reopening during the exit (running animations: ${exiting.animations}) ${back ? `mounted a new ${back.describe}` : "left no content"}; the exiting element must be kept`,
      )
    }
    send(edge.event, { modality: close.mod })
    await act(close.action, close.args, close.mod)
  }

  const scoped = base.scope ? base.scope.bind(base) : (fn: () => Promise<void>) => fn()
  await scoped(async () => {
    try {
      const baseline = await verify(0, null, null, null, null, null, 0)
      let before = baseline
      for (const [i, edge] of path.edges.entries()) {
        const from = oracle.service.getSnapshot().state
        const mapping = mappingOf(contract, edge)
        const announcedBefore = (await base.announcements()).length
        let stepMod: Modality | null = null
        if (mapping?.kind === "delay") {
          const ms = impl.delays?.[edge.event.slice(6)]?.({ props: oracle.props }) ?? 0
          send(edge.event)
          await base.advance(ms)
        } else if (mapping?.kind === "props") {
          const next = { ...oracle.props, ...mapping.props(edge.target ?? edge.source) }
          inputs.push({ kind: "props", props: next })
          oracle.setProps(next)
          await options.rerender?.(next as MachinePropsOf<C["machine"]>, rendered)
        } else if (mapping?.kind === "action") {
          const logBefore = oracle.log.length
          const countBefore = options.activations?.count() ?? 0
          const action =
            (contract.actions as Record<string, Record<string, unknown> | undefined>)[
              mapping.action
            ] ?? {}
          const actionArgs = mapping.args?.(oracle.service.view()) ?? []
          stepMod = stepModality(action, modality)
          // AT 18: the same keys while an IME composes must not commit anything.
          const keyboardImpl = action["keyboard"]
          if (stepMod === "keyboard" && typeof keyboardImpl === "function") {
            await replay(
              i + 1,
              edge,
              "composing",
              keyboardImpl as ActionImpl,
              actionArgs,
              before,
              from,
            )
          }
          // AT 20: a touch never hovers.
          const ownImpl = action[stepMod === "virtual" ? "pointer" : stepMod]
          if (typeof ownImpl === "function") {
            await replay(
              i + 1,
              edge,
              "touch-hover",
              ownImpl as ActionImpl,
              actionArgs,
              before,
              from,
            )
          }
          const valuesBefore = JSON.stringify(oracle.service.view().values)
          send(edge.event, { ...mapping.event?.(oracle.service.view()), modality: stepMod })
          if (contract.formInput?.nativeEvents?.includes(edge.event)) {
            // The browser's own change, dispatched whatever the component does with it.
            userChanges += 1
          } else if (
            JSON.stringify(oracle.service.view().values) !== valuesBefore &&
            !contract.formInput?.silentEvents?.includes(edge.event)
          ) {
            userChanges += 1
          }
          try {
            await runAction(
              contract,
              envFor(stepMod),
              mapping.action,
              actionArgs,
              // A step the oracle does not take: its postcondition cannot hold; the state
              // check below decides.
              edge !== notTaken,
            )
          } catch (e) {
            fail(i + 1, edge, e instanceof Error ? e.message : String(e))
          }
          // Hold the exit as early as possible: right after a closing step, before anything
          // reads it, so a slow run cannot see it end first (CI Linux: a 150 ms exit).
          const closesNow =
            edge !== notTaken &&
            edge.target !== null &&
            expectations(contract, from, null).open &&
            !expectations(contract, edge.target, null).open
          const animatedBefore =
            before?.parts.some((p) => p.part === contract.semantics?.["content"] && p.motion) ===
            true
          const held =
            contract.traits.includes("presence") && closesNow && base.holdAnimations
              ? { resume: await base.holdAnimations(), animatedBefore }
              : undefined
          const closes =
            edge !== notTaken &&
            edge.target !== null &&
            expectations(contract, from, null).open &&
            !expectations(contract, edge.target, null).open
          if (options.activations) {
            const { action: name, count } = options.activations
            const expected = oracle.log
              .slice(logBefore)
              .filter((s) => s.actions.includes(name)).length
            const actual = count() - countBefore
            if (actual !== expected) {
              const prefix = stepMod === "virtual" ? "virtual-parity: " : "activation-parity: "
              fail(i + 1, edge, `${prefix}"${name}" ran ${actual} times, expected ${expected}`)
            }
          }
          if (contract.traits.includes("presence") && closes) {
            await reopenDuringExit(
              i + 1,
              edge,
              { action: mapping.action, args: actionArgs, mod: stepMod },
              held ?? { resume: async () => {}, animatedBefore: false },
            )
          } else await held?.resume()
        } else {
          fail(i + 1, edge, `no contract mapping for ${edge.event}`)
        }
        done.push(`${edge.event}→${oracle.service.getSnapshot().state}`)
        before = await verify(i + 1, edge, before, from, baseline, stepMod, announcedBefore)
      }
      // AT 13: focusing a focusable part with no preceding input commits nothing.
      const state = oracle.service.getSnapshot().state
      const virtualEnv = envFor("virtual")
      const counts = new Map<string, number>()
      for (const p of before.parts) {
        if (p.part === null) continue
        const index = counts.get(p.part) ?? 0
        counts.set(p.part, index + 1)
        if (!p.focusable || p.hidden) continue
        // A hidden form input forwards focus to its control by design (hidden-form-input).
        // (Only contracts whose focus moves state: elsewhere the forwarded focus is checked.)
        if (
          contract.traits.includes("form-associated") &&
          (contract.commitsOnFocus?.length ?? 0) > 0 &&
          p.part === "hidden-input"
        ) {
          continue
        }
        if (contract.commitsOnFocus?.some((c) => c.part === p.part && c.state === state)) continue
        const previous = await observe()
        await virtualEnv.part(p.part).nth(index).focus()
        const { ok, seen, changed } = await unchanged(state, previous)
        // Only a machine that declares FOCUS can be asked what a focus would do.
        const oracleState = hasFocusEvent
          ? whatIf("FOCUS", { modality: "virtual", cause: "other" })
          : state
        if (!ok || oracleState !== state) {
          fail(
            path.edges.length,
            path.edges.at(-1) ?? null,
            `focus-does-not-commit: programmatic focus on ${p.describe} in ${state} changed ${oracleState !== state ? `the machine: ${state} → ${oracleState}` : `${changed.length > 0 ? changed.join(", ") : "the state"}: observed ${JSON.stringify(seen)}`}; list it in the contract's commitsOnFocus if that is intended`,
          )
        }
      }
      // A layer unmounted while open leaves <html> and <body> as they were (radix#3797).
      const layered = contract.traits.some((t) => t === "layer" || t === "modal")
      const unmount = (rendered as { unmount?: unknown } | null | undefined)?.unmount
      if (layered && typeof unmount === "function" && expectations(contract, state, null).open) {
        ;(unmount as () => void)()
        await base.advance(16)
        const page = await base.collectDocument()
        // Assigned inside verify(): TypeScript cannot see that through the closure.
        const last = lastFacts as StepFacts | null
        const problems = last
          ? (genericInvariants["document-clean"]?.({
              ...last,
              after: page,
              atInitial: true,
            }) ?? [])
          : []
        if (problems.length > 0) {
          fail(
            path.edges.length,
            path.edges.at(-1) ?? null,
            `unmounted while open:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
          )
        }
      }
    } finally {
      run = undefined
      if (direction === "rtl") await base.setDirection(null)
    }
  })
}
