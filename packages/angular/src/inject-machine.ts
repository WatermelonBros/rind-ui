import {
  afterNextRender,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  type AnyMachine,
  type BaseDomEnvironment,
  createService,
  type EnvOf,
  type MachinePropsOf,
  type Service,
} from "@rind-ui/core"
import { injectEnvironment } from "./provider"

type ViewOf<M extends AnyMachine> = ReturnType<Service<M>["view"]>

/** Equal props, callbacks aside: they are new closures on every read, reading live state. */
const sameData = (a: object, b: object) => {
  const x = a as Record<string, unknown>
  const y = b as Record<string, unknown>
  const keys = new Set([...Object.keys(x), ...Object.keys(y)])
  for (const k of keys) {
    if (typeof x[k] === "function" && typeof y[k] === "function") continue
    if (!Object.is(x[k], y[k])) return false
  }
  return true
}

/**
 * The environment argument: optional when the base environment satisfies the machine's `env`
 * (or the machine declares none), required otherwise (pass `injectEnvironment(…capabilities)`).
 */
type EnvArgument<M extends AnyMachine> =
  BaseDomEnvironment extends EnvOf<M>
    ? [env?: EnvOf<M>]
    : string extends keyof EnvOf<M>
      ? [env?: EnvOf<M>]
      : [env: EnvOf<M>]

/**
 * Binds one service to a directive instance: created with it, fed the latest inputs, started
 * after the first render in the browser and stopped when the directive is destroyed. Never
 * started on the server.
 */
export function injectMachine<M extends AnyMachine>(
  machine: M,
  props: () => MachinePropsOf<M>,
  ...[env]: EnvArgument<M>
): {
  readonly view: Signal<ViewOf<M>>
  readonly send: Service<M>["send"]
  /** The service, created on first call (after the inputs are set). */
  readonly service: () => Service<M>
} {
  const provided = injectEnvironment()
  // Created on first read, during the first change detection: Angular sets a directive's inputs
  // after its constructor, and a service created before would latch the uncontrolled mode.
  let created: Service<M> | undefined
  const service = () => {
    // Without an `env` argument, EnvArgument<M> proved the base environment satisfies EnvOf<M>.
    created ??= createService(machine, untracked(props), env ?? (provided as EnvOf<M>))
    return created
  }
  const version = signal(0)
  let applied: MachinePropsOf<M> | undefined
  const apply = (next: MachinePropsOf<M>) => {
    applied = next
    service().setProps(next)
  }
  effect(() => {
    const next = props()
    untracked(() => apply(next))
  })
  let off: (() => void) | undefined
  let destroyed = false
  if (inject(PLATFORM_ID) === "browser") {
    afterNextRender(() => {
      if (destroyed) return
      off = service().subscribe(() => version.update((v) => v + 1))
      service().start()
      version.update((v) => v + 1)
    })
  }
  inject(DestroyRef).onDestroy(() => {
    destroyed = true
    off?.()
    created?.stop()
  })
  const view = computed(() => {
    version()
    // view() memoises on (snapshot, shallow props).
    return service().view(props())
  })
  // An event can arrive before the props effect flushed (an input changed in the same tick).
  // Only changed data: an event sent from inside another (a focus a press moves) must not
  // re-apply a controlled value its parent has not passed back yet, which reads as a refusal.
  const send: Service<M>["send"] = (event) => {
    const next = untracked(props)
    if (applied === undefined || !sameData(applied, next)) apply(next)
    service().send(event)
  }
  return { view, send, service }
}
