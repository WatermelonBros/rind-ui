// The hero's component, shared with the scene after it, so the story keeps one object in one
// state: which component this visit shows (app/layout.tsx picks it before paint) and whether it
// is on. A tiny external store: React reads it with useSyncExternalStore.
import { useSyncExternalStore } from "react"

export type HeroKind = "switch" | "checkbox" | "button"
const KINDS: readonly HeroKind[] = ["switch", "checkbox", "button"]

let on = true
const listeners = new Set<() => void>()

export function setHeroOn(value: boolean) {
  on = value
  for (const l of listeners) l()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Whether the hero's component is on (checked); true until the visitor changes it. */
export const useHeroOn = () =>
  useSyncExternalStore(
    subscribe,
    () => on,
    () => true,
  )

/** The component this visit shows; the switch on the server and without the head script. */
export function heroKind(): HeroKind {
  if (typeof document === "undefined") return "switch"
  const picked = document.documentElement.dataset["hero"]
  return KINDS.find((k) => k === picked) ?? "switch"
}
