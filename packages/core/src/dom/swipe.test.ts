// The pure swipe helpers (openspec add-drawer, swipe-gesture): axis lock, damping and the
// release measurement.
import { describe, expect, it } from "vitest"
import {
  damp,
  lockAxis,
  measureRelease,
  releaseVelocity,
  type SwipeSample,
  swipeDirectionOf,
} from "./swipe"

/** A constant-speed flick sampled every `step` ms. */
function flick(speed: number, step: number, duration = 100): SwipeSample[] {
  const out: SwipeSample[] = []
  for (let t = 0; t <= duration; t += step) out.push({ at: speed * t, t })
  return out
}

describe("lockAxis", () => {
  it("claims nothing below the 6 px slop", () => {
    expect(lockAxis(5.9, 0)).toBeNull()
    expect(lockAxis(0, -5)).toBeNull()
    expect(lockAxis(4, 4)).toBeNull()
  })
  it("locks x or y once past the slop with a 2:1 bias", () => {
    expect(lockAxis(6, 0)).toBe("x")
    expect(lockAxis(-20, 10)).toBe("x")
    expect(lockAxis(0, 6)).toBe("y")
    expect(lockAxis(5, -20)).toBe("y")
  })
  it("returns null for a diagonal", () => {
    expect(lockAxis(20, 15)).toBeNull()
    expect(lockAxis(20, 11)).toBeNull()
    expect(lockAxis(-30, 30)).toBeNull()
  })
})

describe("damp", () => {
  it("keeps the sign and always moves less than the pointer past 1 px", () => {
    for (const d of [1.5, 4, 100, 1000]) {
      expect(damp(d)).toBeGreaterThan(0)
      expect(damp(-d)).toBeLessThan(0)
      expect(Math.abs(damp(d))).toBeLessThan(d)
      expect(damp(-d)).toBe(-damp(d))
    }
    expect(damp(0)).toBe(0)
  })
})

describe("swipeDirectionOf", () => {
  it("maps the sign on each axis", () => {
    expect(swipeDirectionOf("x", 5)).toBe("right")
    expect(swipeDirectionOf("x", -5)).toBe("left")
    expect(swipeDirectionOf("y", 5)).toBe("down")
    expect(swipeDirectionOf("y", -5)).toBe("up")
  })
})

describe("releaseVelocity", () => {
  it("is within 10 % of 1 px/ms at 60 Hz and 120 Hz input (base-ui#5837)", () => {
    for (const step of [16.7, 8.3]) {
      const samples = flick(1, step)
      const v = releaseVelocity(samples, samples.at(-1)?.t ?? 0)
      expect(v).not.toBeNull()
      expect(Math.abs((v ?? 0) - 1)).toBeLessThan(0.1)
    }
  })
  it("ignores samples older than 100 ms", () => {
    // Old slow part (0.1 px/ms) then a fast recent part (2 px/ms).
    const samples: SwipeSample[] = [
      { at: 0, t: 0 },
      { at: 10, t: 100 },
      { at: 10, t: 200 },
      { at: 50, t: 220 },
      { at: 90, t: 240 },
    ]
    expect(releaseVelocity(samples, 240)).toBeCloseTo(2, 5)
  })
  it("is null when the last sample is older than 80 ms at release", () => {
    expect(releaseVelocity(flick(1, 10, 50), 50 + 81)).toBeNull()
    expect(releaseVelocity(flick(1, 10, 50), 50 + 80)).not.toBeNull()
  })
  it("is null without samples or with a single one", () => {
    expect(releaseVelocity([], 0)).toBeNull()
    expect(releaseVelocity([{ at: 0, t: 0 }], 0)).toBeNull()
  })
  it("is signed", () => {
    expect(
      releaseVelocity(
        [
          { at: 0, t: 0 },
          { at: -50, t: 50 },
        ],
        50,
      ),
    ).toBe(-1)
  })
})

describe("measureRelease", () => {
  const base = {
    axis: "y",
    delta: 200,
    furthest: 200,
    samples: flick(1, 10, 50),
    now: 50,
    allowed: ["down"],
    size: 400,
  } as const

  it("reports direction, offset, velocity and size", () => {
    const r = measureRelease(base)
    expect(r.direction).toBe("down")
    expect(r.offset).toBe(200)
    expect(r.size).toBe(400)
    expect(r.velocity).toBeCloseTo(1, 5)
  })
  it("reports no direction for a direction that is not allowed", () => {
    const r = measureRelease({ ...base, delta: -200, furthest: -200 })
    expect(r).toEqual({ direction: null, offset: 0, velocity: 0, size: 400 })
  })
  it("reports no direction without a locked axis or movement", () => {
    expect(measureRelease({ ...base, axis: null }).direction).toBeNull()
    expect(measureRelease({ ...base, delta: 0, furthest: 0 }).direction).toBeNull()
  })
  it("change of mind: 150 toward the edge then back 40 is no direction", () => {
    const r = measureRelease({ ...base, delta: 110, furthest: 150 })
    expect(r.direction).toBeNull()
    expect(r.offset).toBe(0)
  })
  it("a small reversal (10 px) still counts", () => {
    expect(measureRelease({ ...base, delta: 140, furthest: 150 }).direction).toBe("down")
  })
  it("velocity is never negative", () => {
    const back = [
      { at: 200, t: 0 },
      { at: 150, t: 50 },
    ]
    expect(measureRelease({ ...base, samples: back }).velocity).toBe(0)
    expect(measureRelease({ ...base, samples: [] }).velocity).toBe(0)
  })
  it("velocity is toward the direction for negative deltas", () => {
    const up = [
      { at: 0, t: 0 },
      { at: -50, t: 50 },
    ]
    const r = measureRelease({
      ...base,
      delta: -200,
      furthest: -200,
      allowed: ["up"],
      samples: up,
    })
    expect(r.direction).toBe("up")
    expect(r.velocity).toBe(1)
  })
})
