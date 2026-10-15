// Where rind-ui modules that keep document-level state register how to clear it.
// @rind-ui/testing's resetRindGlobals() runs every registered reset after each test.

const RESETS = Symbol.for("rind-ui.resets")

export function registerReset(reset: () => void): void {
  let set: Set<() => void> | undefined = Reflect.get(globalThis, RESETS)
  if (!set) {
    set = new Set()
    Reflect.set(globalThis, RESETS, set)
  }
  set.add(reset)
}
