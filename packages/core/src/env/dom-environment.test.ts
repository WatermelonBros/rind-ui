import { afterEach, expect, it, vi } from "vitest"
import { domEnvironment } from "./dom-environment"

afterEach(() => {
  vi.useRealTimers()
})

it("resolves timers at call time: fake timers installed after creation drive it", () => {
  const env = domEnvironment({ getRootNode: () => ({}) as Document })
  vi.useFakeTimers()
  const fn = vi.fn()
  // fake-time: vi.useFakeTimers drives it
  env.scheduler.setTimeout(fn, 100)
  vi.advanceTimersByTime(100)
  expect(fn).toHaveBeenCalledTimes(1)
  // fake-time: vi.useFakeTimers drives it
  const h = env.scheduler.setTimeout(fn, 100)
  env.scheduler.clearTimeout(h)
  vi.advanceTimersByTime(100)
  expect(fn).toHaveBeenCalledTimes(1)
})
