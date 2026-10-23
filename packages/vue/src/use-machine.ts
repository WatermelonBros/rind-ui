import {
  type AnyMachine,
  type BaseDomEnvironment,
  createService,
  type EnvOf,
  type MachinePropsOf,
  type Service,
} from "@rind-ui/core"
import {
  type ComputedRef,
  computed,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watchEffect,
} from "vue"
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
 * Binds one service to a component instance: created at setup, fed the latest props before
 * every render, started after mount and stopped before unmount. Never started on the server.
 */
export function useMachine<M extends AnyMachine>(
  machine: M,
  props: () => MachinePropsOf<M>,
  ...[env]: EnvArgument<M>
): {
  readonly view: ComputedRef<ViewOf<M>>
  readonly send: Service<M>["send"]
  readonly service: Service<M>
} {
  const provided = useEnvironment()
  // Without an `env` argument, EnvArgument<M> proved the base environment satisfies EnvOf<M>.
  const service = createService(machine, props(), env ?? (provided as EnvOf<M>))
  const version = shallowRef(0)
  watchEffect(() => service.setProps(props()), { flush: "pre" })
  let off: (() => void) | undefined
  onMounted(() => {
    off = service.subscribe(() => version.value++)
    service.start()
    version.value++
  })
  onBeforeUnmount(() => {
    off?.()
    service.stop()
  })
  const view = computed(() => {
    void version.value
    // view() memoises on (snapshot, shallow props).
    return service.view(props())
  })
  return { view, send: service.send, service }
}
