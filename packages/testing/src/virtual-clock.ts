// A virtual clock for the machines' delays: `setTimeout` runs only when the test advances
// it, so a delayed transition (a tooltip's open delay, a stepper's repeat) never waits for
// real time. Animation frames stay real: layout and presence still need them.
// Pass `clock.scheduler` as `RindProvider environment={{ scheduler }}` and `clock` to
// `testMachine({ clock })`.

import type { Scheduler, TimerHandle } from "@rind-ui/core"

export interface VirtualClock {
  readonly scheduler: Scheduler
  /** Moves time forward by `ms`, running every timer that falls due, in order. */
  advance(ms: number): void
  /** Timers not run yet. */
  pending(): number
}

export function virtualClock(): VirtualClock {
  let now = 0
  let seq = 0
  const timers = new Map<number, { at: number; callback: () => void }>()
  return {
    scheduler: {
      setTimeout: (callback, ms) => {
        const id = ++seq
        timers.set(id, { at: now + Math.max(0, ms), callback })
        return id as TimerHandle
      },
      clearTimeout: (handle) => {
        timers.delete(handle as number)
      },
      requestAnimationFrame: (callback) => globalThis.requestAnimationFrame(() => callback()),
      cancelAnimationFrame: (handle) => globalThis.cancelAnimationFrame(handle as number),
    },
    advance(ms) {
      const end = now + ms
      for (;;) {
        // The earliest due timer (ties: the one set first); timers set while running count.
        let next: [number, { at: number; callback: () => void }] | undefined
        for (const entry of timers) {
          if (entry[1].at > end) continue
          if (!next || entry[1].at < next[1].at) next = entry
        }
        if (!next) break
        timers.delete(next[0])
        now = next[1].at
        next[1].callback()
      }
      now = end
    },
    pending: () => timers.size,
  }
}
