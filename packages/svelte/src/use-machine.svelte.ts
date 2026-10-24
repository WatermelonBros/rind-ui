import {
  type AnyMachine,
  type BaseDomEnvironment,
  createService,
  type EnvOf,
  type MachinePropsOf,
  type Service,
} from "@rind-ui/core"
import { untrack } from "svelte"
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
 * Binds one service to a component instance: created at initialisation, fed the latest props
 * before every update, started after mount and stopped on destroy. Never started on the
 * server (effects do not run there). Read `.view` for the current view.
 */
export function useMachine<M extends AnyMachine>(
  machine: M,
  props: () => MachinePropsOf<M>,
  ...[env]: EnvArgument<M>
): { readonly view: ViewOf<M>; readonly send: Service<M>["send"]; readonly service: Service<M> } {
  const provided = useEnvironment()
  // Without an `env` argument, EnvArgument<M> proved the base environment satisfies EnvOf<M>.
  const service = createService(machine, untrack(props), env ?? (provided as EnvOf<M>))
  let version = $state(0)
  $effect.pre(() => {
    const next = props()
    untrack(() => service.setProps(next))
  })
  $effect(() =>
    untrack(() => {
      // Untracked: a `send` from inside another effect notifies synchronously, and reading
      // `version` there would make that effect depend on it (and re-run on every change).
      const off = service.subscribe(() => untrack(() => version++))
      service.start()
      version++
      return () => {
        off()
        service.stop()
      }
    }),
  )
  // view() memoises on (snapshot, shallow props).
  const view = $derived.by(() => {
    void version
    return service.view(props())
  })
  return {
    get view() {
      return view
    },
    send: service.send,
    service,
  }
}
