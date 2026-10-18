// Splitter math (design §3): sizes are percentages of the panels' space, summing to 100.
// `resizeAt` is a port of react-resizable-panels' `adjustLayoutByDelta` (MIT, Brian Vaughn,
// github.com/bvaughn/react-resizable-panels): the same steps, written against this module's
// constraint shape. Pure: runs in Node, so the model test's oracle computes what the page
// shows.

/** A panel's constraints, resolved to percentages of the panels' space. */
export interface SplitterConstraints {
  /** Smallest size (default 0). */
  readonly min?: number | undefined
  /** Largest size (default 100). */
  readonly max?: number | undefined
  /** Below `min`, the panel snaps to `collapsedSize` (default false). */
  readonly collapsible?: boolean | undefined
  /** The collapsed size (default 0). */
  readonly collapsedSize?: number | undefined
}

/** What started a resize: keyboard steps collapse and expand at `min`, whatever the step. */
export type ResizeTrigger = "pointer" | "keyboard" | "api"

const DIGITS = 10
const fuzzy = (a: number, b: number) => {
  if (a.toFixed(DIGITS) === b.toFixed(DIGITS)) return 0
  return a > b ? 1 : -1
}
const eq = (a: number, b: number) => fuzzy(a, b) === 0

/** Two size arrays are the same layout (to the module's precision). */
export const sameSizes = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => eq(v, b[i] ?? Number.NaN))

const minOf = (c: SplitterConstraints | undefined) => c?.min ?? 0
const maxOf = (c: SplitterConstraints | undefined) => c?.max ?? 100
const collapsedOf = (c: SplitterConstraints | undefined) => c?.collapsedSize ?? 0

/** Whether panel `c` is collapsible and at its collapsed size. */
export const isCollapsed = (c: SplitterConstraints | undefined, size: number | undefined) =>
  c?.collapsible === true && size !== undefined && eq(size, collapsedOf(c))

/** One panel's size within its constraints; a collapsible one snaps at the halfway point. */
export function clampSize(c: SplitterConstraints | undefined, size: number): number {
  let s = size
  if (fuzzy(s, minOf(c)) < 0) {
    if (c?.collapsible === true) {
      const half = (collapsedOf(c) + minOf(c)) / 2
      s = fuzzy(s, half) < 0 ? collapsedOf(c) : minOf(c)
    } else s = minOf(c)
  }
  return Number.parseFloat(Math.min(maxOf(c), s).toFixed(DIGITS))
}

/** Scales `sizes` to 100 and clamps each panel, giving the leftover to whoever accepts it. */
export function validateSizes(
  sizes: readonly number[],
  panels: readonly SplitterConstraints[],
): number[] {
  const total = sizes.reduce((a, b) => a + b, 0)
  const next = sizes.map((s) => (total > 0 && !eq(total, 100) ? (s * 100) / total : s))
  let rest = 0
  next.forEach((s, i) => {
    const safe = clampSize(panels[i], s)
    rest += s - safe
    next[i] = safe
  })
  for (let i = 0; i < next.length && !eq(rest, 0); i++) {
    const s = next[i] ?? 0
    const safe = clampSize(panels[i], s + rest)
    rest -= safe - s
    next[i] = safe
  }
  return next
}

/**
 * The sizes to render: `value` with one entry per panel, else `defaults` with one entry per
 * panel, else an equal split; validated.
 */
export function resolveSizes(
  value: readonly number[] | undefined,
  defaults: readonly number[] | undefined,
  panels: readonly SplitterConstraints[],
): number[] {
  const n = panels.length
  const fits = (v: readonly number[] | undefined): v is readonly number[] =>
    v !== undefined &&
    v.length === n &&
    v.every((s) => Number.isFinite(s) && s >= 0) &&
    // All zero cannot be scaled to 100.
    v.some((s) => s > 0)
  const given = fits(value) ? value : fits(defaults) ? defaults : Array<number>(n).fill(100 / n)
  return validateSizes(given, panels)
}

/**
 * The sizes after moving the boundary after panel `handle` by `delta` percent (positive grows
 * the panel before it). A step that cannot keep the total at 100 returns `sizes`.
 */
export function resizeAt(
  sizes: readonly number[],
  panels: readonly SplitterConstraints[],
  handle: number,
  delta: number,
  trigger: ResizeTrigger,
): readonly number[] {
  if (eq(delta, 0)) return sizes
  const first = handle
  const second = handle + 1
  if (first < 0 || second >= sizes.length) return sizes
  const size = (i: number) => sizes[i] ?? 0
  let d = delta

  if (trigger === "keyboard") {
    // Expanding a collapsed panel: at least to its `min`, whatever the step.
    {
      const i = d < 0 ? second : first
      const c = panels[i]
      if (c?.collapsible === true && eq(size(i), collapsedOf(c))) {
        const local = minOf(c) - size(i)
        if (fuzzy(local, Math.abs(d)) > 0) d = d < 0 ? -local : local
      }
    }
    // Collapsing a panel at its `min`: all the way, whatever the step.
    {
      const i = d < 0 ? first : second
      const c = panels[i]
      if (c?.collapsible === true && eq(size(i), minOf(c))) {
        const local = size(i) - collapsedOf(c)
        if (fuzzy(local, Math.abs(d)) > 0) d = d < 0 ? -local : local
      }
    }
  }

  // A collapsed panel on the growing side that passes the halfway point snaps to its `min`:
  // the delta takes that much from the shrinking side (spec "Collapse"; RRP would reject the
  // step and keep the panel collapsed until the pointer reaches `min`).
  {
    const pivot = d < 0 ? second : first
    const want = size(pivot) + Math.abs(d)
    const snapped = clampSize(panels[pivot], want)
    if (fuzzy(snapped, want) > 0) d = d < 0 ? -(snapped - size(pivot)) : snapped - size(pivot)
  }

  // The room on the growing side bounds the delta.
  {
    const step = d < 0 ? 1 : -1
    let room = 0
    for (let i = d < 0 ? second : first; i >= 0 && i < sizes.length; i += step) {
      room += clampSize(panels[i], 100) - size(i)
    }
    const abs = Math.min(Math.abs(d), Math.abs(room))
    d = d < 0 ? -abs : abs
  }

  const next = [...sizes]
  let applied = 0
  // The shrinking side, outward from the handle.
  {
    const step = d < 0 ? -1 : 1
    for (let i = d < 0 ? first : second; i >= 0 && i < sizes.length; i += step) {
      const want = Math.abs(d) - Math.abs(applied)
      const safe = clampSize(panels[i], size(i) - want)
      if (!eq(size(i), safe)) {
        applied += size(i) - safe
        next[i] = safe
        if (
          applied.toPrecision(3).localeCompare(Math.abs(d).toPrecision(3), undefined, {
            numeric: true,
          }) >= 0
        )
          break
      }
    }
  }
  if (sameSizes(sizes, next)) return sizes

  // The growing side: the panel at the handle takes what was freed, the rest goes outward.
  {
    const pivot = d < 0 ? second : first
    const unsafe = size(pivot) + applied
    const safe = clampSize(panels[pivot], unsafe)
    next[pivot] = safe
    if (!eq(safe, unsafe)) {
      let rest = unsafe - safe
      const step = d > 0 ? -1 : 1
      for (let i = pivot; i >= 0 && i < sizes.length; i += step) {
        const before = next[i] ?? 0
        const grown = clampSize(panels[i], before + rest)
        if (!eq(before, grown)) {
          rest -= grown - before
          next[i] = grown
        }
        if (eq(rest, 0)) break
      }
    }
  }
  const total = next.reduce((a, b) => a + b, 0)
  return eq(total, 100) ? next : sizes
}

/** The smallest and largest sizes panel `handle` can reach by moving that handle. */
export function handleBounds(
  sizes: readonly number[],
  panels: readonly SplitterConstraints[],
  handle: number,
): readonly [number, number] {
  const now = sizes[handle] ?? 0
  const lo = resizeAt(sizes, panels, handle, -100, "keyboard")[handle] ?? now
  const hi = resizeAt(sizes, panels, handle, 100, "keyboard")[handle] ?? now
  return [Math.min(lo, now), Math.max(hi, now)]
}

/** A size as written in `data-size` (stable across server and client). */
export const formatSize = (n: number) => String(Math.round(n * 1e4) / 1e4)
