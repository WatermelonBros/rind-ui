import type { MotionPreference } from "../env/capabilities"

const QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Follows `prefers-reduced-motion` (matchMedia read lazily, so nothing runs on the
 * server), or a fixed value when overridden.
 */
export function motionPreference(override?: boolean): MotionPreference {
  if (override !== undefined) {
    return { reducedMotion: () => override, subscribeReducedMotion: () => () => {} }
  }
  const media = () => globalThis.matchMedia?.(QUERY)
  return {
    reducedMotion: () => media()?.matches ?? false,
    subscribeReducedMotion(listener) {
      const query = media()
      if (!query) return () => {}
      const onChange = (e: MediaQueryListEvent) => listener(e.matches)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
  }
}
