/** A deeply reactive copy of `props`: assigning to it updates the mounted component. */
export function reactiveProps<P extends object>(props: P): P {
  const state = $state({ ...props })
  return state as P
}
