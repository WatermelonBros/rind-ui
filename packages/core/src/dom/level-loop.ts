// level-loop (add-agent-presence design §4): an audio level, pulled each frame, written as CSS
// custom properties outside the framework's rendering (60 state updates a second would flood
// it), smoothed (fast attack, slow release), with a coarse `data-level` band at most every
// 250 ms for CSS without custom properties and for tests.

import type { Scheduler } from "../env/capabilities"

export type LevelChannel = "input" | "output"

export interface LevelLoopOptions {
  readonly getLevel: (channel: LevelChannel) => number
  readonly channel: LevelChannel
  readonly scheduler: Scheduler
  /** Per-frame smoothing toward a rising (attack) or falling (release) level, 0–1. */
  readonly attack?: number | undefined
  readonly release?: number | undefined
  readonly now: () => number
}

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/** One smoothing step from `from` toward `to`. */
export function smoothLevel(from: number, to: number, attack = 0.5, release = 0.15) {
  const k = to > from ? attack : release
  return from + (to - from) * k
}

/** The band of a level: 0 (silent) to 3 (loud). */
export const levelBand = (level: number) =>
  level < 0.05 ? 0 : level < 0.35 ? 1 : level < 0.7 ? 2 : 3

/** Writes the level to `root` each frame until the returned stop; resets to 0 on stop. */
export function startLevelLoop(root: HTMLElement, o: LevelLoopOptions): () => void {
  let level = 0
  let band = -1
  let bandAt = Number.NEGATIVE_INFINITY
  let frame = o.scheduler.requestAnimationFrame(step)
  function write(value: number) {
    const text = value.toFixed(3)
    root.style.setProperty("--rind-agent-presence-level", text)
    root.style.setProperty(`--rind-agent-presence-${o.channel}-level`, text)
  }
  function step() {
    level = smoothLevel(level, clamp(o.getLevel(o.channel)), o.attack, o.release)
    write(level)
    const t = o.now()
    const next = levelBand(level)
    if (next !== band && t - bandAt >= 250) {
      band = next
      bandAt = t
      root.dataset["level"] = String(next)
    }
    frame = o.scheduler.requestAnimationFrame(step)
  }
  return () => {
    o.scheduler.cancelAnimationFrame(frame)
    write(0)
    root.dataset["level"] = "0"
  }
}
