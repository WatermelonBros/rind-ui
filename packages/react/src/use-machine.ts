"use client"

import {
  type AnyMachine,
  type BaseDomEnvironment,
  createService,
  type EnvOf,
  type MachinePropsOf,
  type Service,
  type View,
} from "@rind-ui/core"
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react"
import { useEnvironment } from "./provider"

// useLayoutEffect warns on the server; it never runs there anyway.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

type ViewOf<M extends AnyMachine> = ReturnType<Service<M>["view"]>

/**
 * The environment argument: optional when the base environment satisfies the machine's `env`
 * (or the machine declares none: `Record<string, never>`), required otherwise (pass
 * `useEnvironment(…the capabilities it needs)`).
 */
type EnvArgument<M extends AnyMachine> = BaseDomEnvironment extends EnvOf<M>
  ? [env?: EnvOf<M>]
  : string extends keyof EnvOf<M>
    ? [env?: EnvOf<M>]
    : [env: EnvOf<M>]

/**
 * Binds one service to a component instance: created once, fed the latest props on every
 * commit, started after mount and stopped on unmount. Never started on the server.
 */
export function useMachine<M extends AnyMachine>(
  machine: M,
  props: MachinePropsOf<M>,
  ...[env]: EnvArgument<M>
): { readonly view: ViewOf<M>; readonly send: Service<M>["send"]; readonly service: Service<M> } {
  const provided = useEnvironment()
  // Without an `env` argument, EnvArgument<M> proved the base environment satisfies EnvOf<M>.
  const [service] = useState(() => createService(machine, props, env ?? (provided as EnvOf<M>)))
  useIsoLayoutEffect(() => service.setProps(props))
  useEffect(() => {
    service.start()
    return () => service.stop()
  }, [service])
  useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
  // view() memoises on (snapshot, shallow props), so this and useSelector share one view.
  return { view: service.view(props), send: service.send, service }
}

/**
 * Subscribes to a slice of the service's view; re-renders only when the slice changes by
 * `equal`. Re-selects when the snapshot, the committed props or the selector change, so a
 * selector closing over props stays current.
 */
export function useSelector<M extends AnyMachine, T>(
  service: Service<M>,
  select: (view: ViewOf<M>) => T,
  equal: (a: T, b: T) => boolean = Object.is,
): T {
  const [cache] = useState<{ view?: unknown; select?: unknown; value?: T }>(() => ({}))
  const get = () => {
    const view = service.view()
    if (cache.view === view && cache.select === select) return cache.value as T
    const value = select(view)
    const keep = "value" in cache && equal(cache.value as T, value)
    cache.view = view
    cache.select = select
    if (!keep) cache.value = value
    return cache.value as T
  }
  return useSyncExternalStore(service.subscribe, get, get)
}

export type { View }
