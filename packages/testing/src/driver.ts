import type {
  ActionArgsOf,
  Announcement,
  AnyContract,
  By,
  Env,
  ModalitiesOf,
  Modality,
  Observations,
  Part,
  PlatformFlags,
  QueryArgsOf,
} from "@rind-ui/core"
import {
  type AdapterEnv,
  type Direction,
  type EnvFactory,
  isEnvFactory,
  mirror,
  UntilTimeout,
} from "./adapter"
import { domEnv } from "./adapters/dom"
import { type PlaywrightTarget, playwrightEnv } from "./adapters/playwright"

/**
 * What a driver runs against: an adapter's env factory, a Playwright Page / Locator /
 * FrameLocator, or anything Testing Library works with (`screen`, a container, document).
 */
export type Target = EnvFactory | PlaywrightTarget | object

type Actions<C extends AnyContract> = C["actions"]
type Queries<C extends AnyContract> = C["queries"]

/** Every modality some action of the contract declares. */
export type ContractModality<C extends AnyContract> = {
  [K in keyof Actions<C>]: ModalitiesOf<Actions<C>[K]>
}[keyof Actions<C>]

export type Driver<C extends AnyContract> = {
  readonly [K in keyof Actions<C>]: (...args: ActionArgsOf<Actions<C>[K]>) => Promise<void>
} & {
  readonly [K in keyof Queries<C>]: (
    ...args: QueryArgsOf<Queries<C>[K]>
  ) => ReturnType<Queries<C>[K]>
} & {
  /** The same driver, bound to another modality the contract declares. */
  via(modality: ContractModality<C>): Driver<C>
  /** A part of this instance. */
  part(name: C["anatomy"][number], by?: By): Part
  readonly contract: C
  readonly modality: Modality
  /** The adapter environment, for runners. */
  readonly env: AdapterEnv
  /** Announcements made since the driver was created (message, priority, key). */
  announcements(): Promise<readonly Announcement[]>
}

/** Resolves a target to its adapter by duck typing: `locator` means Playwright. */
export function toEnvFactory(target: Target): EnvFactory {
  if (isEnvFactory(target)) return target
  if (typeof (target as { locator?: unknown }).locator === "function") {
    // Only Playwright's Page, Locator and FrameLocator have a `locator` method.
    return playwrightEnv(target as PlaywrightTarget)
  }
  const isContainer = typeof Element !== "undefined" && target instanceof Element
  return domEnv(isContainer ? { root: target } : {})
}

/** Wraps keyboard input so horizontal arrows are mirrored in right-to-left runs. */
export function directed(env: AdapterEnv, direction: Direction): AdapterEnv {
  if (direction === "ltr") return env
  const wrap = (part: Part): Part => ({
    ...part,
    press: (key, options) => part.press(mirror(key, direction), options),
    nth: (i) => wrap(part.nth(i)),
    all: async () => (await part.all()).map(wrap),
    scoped: (scope, inner) => wrap(part.scoped(scope, inner)),
    labelled: () => wrap(part.labelled()),
  })
  return {
    ...env,
    part: (name, by) => wrap(env.part(name, by)),
    find: (by) => wrap(env.find(by)),
    focused: () => wrap(env.focused()),
    keyboard: (key, options) => env.keyboard(mirror(key, direction), options),
  }
}

type ActionShape = Partial<Record<Modality, (env: Env, ...args: unknown[]) => Promise<unknown>>> & {
  readonly done: Record<string, unknown> | ((env: Env, ...args: unknown[]) => Promise<boolean>)
}

/** Reads every query of the contract, for failure messages. */
async function observe(contract: AnyContract, env: Env): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [name, query] of Object.entries(contract.queries)) {
    // A query with arguments has no single reading.
    if (query.length > 1) continue
    // Queries take the contract's own Env; the adapter env implements it.
    out[name] = await (query as (env: Env) => Promise<unknown>)(env).catch(
      (e: unknown) => `<${e instanceof Error ? e.message : String(e)}>`,
    )
  }
  return out
}

/** Runs one action in one modality and waits for its postcondition. */
export async function runAction(
  contract: AnyContract,
  env: AdapterEnv,
  name: string,
  args: readonly unknown[],
  /** False when the caller checks the outcome itself (a step the oracle does not take). */
  checkDone = true,
): Promise<void> {
  const { modality } = env
  // Contract actions have this shape; the public type is a refinement of it.
  const action = contract.actions[name] as ActionShape | undefined
  if (!action) throw new Error(`${contract.scope}.${name} is not an action`)
  const impl = action[modality] ?? (modality === "virtual" ? action.pointer : undefined)
  if (!impl) throw new Error(`${contract.scope}.${name} has no "${modality}" implementation`)
  await env.markNavigations()
  await impl(env, ...args)
  if (!checkDone) return
  const { done } = action
  const check =
    typeof done === "function"
      ? () => done(env, ...args)
      : async () => {
          const seen = await observe(contract, env)
          return Object.entries(done).every(([q, v]) => Object.is(seen[q], v))
        }
  try {
    await env.until(check, (ok) => ok)
  } catch (e) {
    const seen = await observe(contract, env)
    const expected = typeof done === "function" ? "its postcondition" : JSON.stringify(done)
    throw new Error(
      `${contract.scope}.${name} [${modality}]: expected ${expected}, observed ${JSON.stringify(seen)}${
        e instanceof UntilTimeout ? "" : ` (${e instanceof Error ? e.message : String(e)})`
      }`,
    )
  }
}

export interface DriverOptions {
  /** The platform the test runs as (default: Linux/Chromium-like): the `mod` key follows it. */
  readonly platform?: PlatformFlags
  /** The locale the component was rendered with (informational for runners). */
  readonly locale?: string
  /** Every action runs in this modality. Default: each action's first of pointer, keyboard, touch. */
  readonly modality?: Modality
  readonly direction?: Direction
}

const PREFERENCE: readonly Modality[] = ["pointer", "keyboard", "touch"]

function make<C extends AnyContract>(
  contract: C,
  factory: EnvFactory,
  anchor: By,
  options: DriverOptions,
): Driver<C> {
  const direction = options.direction ?? "ltr"
  const envs = new Map<Modality, AdapterEnv>()
  const envFor = (modality: Modality) => {
    let env = envs.get(modality)
    if (!env) {
      env = directed(
        factory.create({
          scope: contract.scope,
          anchor,
          modality,
          ...(options.platform ? { platform: options.platform } : {}),
        }),
        direction,
      )
      envs.set(modality, env)
    }
    return env
  }
  const base = envFor(options.modality ?? "pointer")
  // Taken when the driver is created: later announcements belong to it.
  // Never left rejected: a test may end (and its page close) before reading announcements.
  const start = base.announcements().then(
    (log) => log.length,
    () => 0,
  )
  const driver: Record<string, unknown> = {
    announcements: async () => (await base.announcements()).slice(await start),
    contract,
    modality: base.modality,
    env: base,
    via: (modality: Modality) => make(contract, factory, anchor, { ...options, modality }),
    part: (name: string, by?: By) => base.part(name, by),
  }
  for (const [name, action] of Object.entries(contract.actions)) {
    const modality = options.modality ?? PREFERENCE.find((m) => m in action) ?? "pointer"
    driver[name] = (...args: unknown[]) => runAction(contract, envFor(modality), name, args)
  }
  for (const [name, query] of Object.entries(contract.queries)) {
    driver[name] = (...args: unknown[]) =>
      (query as (env: Env, ...rest: unknown[]) => Promise<unknown>)(base, ...args)
  }
  // Built from the contract's own action and query names, which is what Driver<C> maps.
  return driver as Driver<C>
}

/**
 * A typed driver for one component instance, located by the contract's anchor (role and
 * exact accessible name). The target picks the adapter.
 */
export function createDriver<const C extends AnyContract>(
  contract: C,
  target: Target,
  ...anchor: Parameters<C["locate"]>
): Driver<C> {
  return createDriverWith(contract, target, anchor)
}

/** `createDriver` with options (modality, direction). */
export function createDriverWith<const C extends AnyContract>(
  contract: C,
  target: Target,
  anchor: Parameters<C["locate"]>,
  options: DriverOptions = {},
): Driver<C> {
  // `locate` takes exactly the anchor parameters the caller passed.
  const by = (contract.locate as (...a: unknown[]) => By)(...anchor)
  return make(contract, toEnvFactory(target), by, options)
}

export type { Observations }
