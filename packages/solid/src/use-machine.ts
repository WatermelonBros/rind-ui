import {
  type AnyMachine,
  type BaseDomEnvironment,
  createService,
  type EnvOf,
  type MachinePropsOf,
  type Service,
} from "@rind-ui/core"
import {
  type Accessor,
  createComputed,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js"
import { afterMount } from "./lifecycle"
import { useEnvironment } from "./provider"

type ViewOf<M extends AnyMachine> = ReturnType<Service<M>["view"]>

/**
 * The environment argument: optional when the base environment satisfies the machine's `env`
 * (or the machine declares none), required otherwise (pass `useEnvironment(…capabilities)`).
 */
type EnvArgument<M extends AnyMachine> =
  BaseDomEnvironment extends EnvOf<M>
    ? [env?: EnvOf<M>]
    : string extends keyof EnvOf<M>
      ? [env?: EnvOf<M>]
      : [env: EnvOf<M>]

/**
 * Binds one service to a component instance: created when the component runs, fed the latest
 * props whenever one it reads changes, started after mount and stopped on cleanup. Never
 * started on the server (`onMount` does not run there).
 */
export function useMachine<M extends AnyMachine>(
  machine: M,
  props: () => MachinePropsOf<M>,
  ...[env]: EnvArgument<M>
): {
  readonly view: Accessor<ViewOf<M>>
  readonly send: Service<M>["send"]
  readonly service: Service<M>
} {
  const provided = useEnvironment()
  // Without an `env` argument, EnvArgument<M> proved the base environment satisfies EnvOf<M>.
  const service = createService(machine, untrack(props), env ?? (provided as EnvOf<M>))
  const [version, setVersion] = createSignal(0)
  // Before the parts read the view: a prop change reaches the service first.
  createComputed(() => {
    const next = props()
    untrack(() => service.setProps(next))
  })
  afterMount(() => {
    const off = service.subscribe(() => setVersion((v) => v + 1))
    service.start()
    setVersion((v) => v + 1)
    onCleanup(() => {
      off()
      service.stop()
    })
  })
  const view = createMemo(() => {
    version()
    // view() memoises on (snapshot, shallow props).
    return service.view(props())
  })
  return { view, send: service.send, service }
}
