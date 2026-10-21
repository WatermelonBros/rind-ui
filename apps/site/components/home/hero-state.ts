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

// The scene after the hero hands the 3D object its own control and state: the object travels
// from the hero to that control (skin-scene.tsx) and follows its state there.
let peelTarget: HTMLElement | null = null
let peelOn = true
const peelListeners = new Set<() => void>()
export const setPeelTarget = (el: HTMLElement | null) => {
  peelTarget = el
}
export const getPeelTarget = () => peelTarget
export function setPeelOn(value: boolean) {
  if (value === peelOn) return
  peelOn = value
  for (const l of peelListeners) l()
}
export const getPeelOn = () => peelOn
export const onPeelOn = (l: () => void) => {
  peelListeners.add(l)
  return () => peelListeners.delete(l)
}

// whether the 3D object is drawing: the controls it stands over hide their own look
let sceneGl = false
const glListeners = new Set<() => void>()
export function setSceneGl(value: boolean) {
  sceneGl = value
  for (const l of glListeners) l()
}
export const useSceneGl = () =>
  useSyncExternalStore(
    (l) => {
      glListeners.add(l)
      return () => glListeners.delete(l)
    },
    () => sceneGl,
    () => false,
  )
