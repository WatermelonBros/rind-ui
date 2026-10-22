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

// whether the travelling object has landed on the next scene's control: its label shows then
let landed = false
const landedListeners = new Set<() => void>()
export function setLanded(value: boolean) {
  if (value === landed) return
  landed = value
  for (const l of landedListeners) l()
}
export const useLanded = () =>
  useSyncExternalStore(
    (l) => {
      landedListeners.add(l)
      return () => landedListeners.delete(l)
    },
    () => landed,
    () => false,
  )

// The builder after the machine: the object's last stop is the preview component of its kind,
// and on the way it takes the visitor's colours (any-look.tsx publishes both)
let lookTarget: HTMLElement | null = null
let lookColors: { brand: string; surface: string } = { brand: "#18181B", surface: "#FFFFFF" }
export const setLookTarget = (el: HTMLElement | null) => {
  lookTarget = el
}
export const getLookTarget = () => lookTarget
export const setLookColors = (colors: { brand: string; surface: string }) => {
  lookColors = colors
}
export const getLookColors = () => lookColors

// The tests section: the object's final stop. It stands over the test's control, the test runs
// once it arrives, and it follows the control's state as the driver moves it (tested.tsx).
let testTarget: HTMLElement | null = null
export const setTestTarget = (el: HTMLElement | null) => {
  testTarget = el
  // a new run remounts the control: the scene must look again even if nothing scrolls
  for (const l of testListeners) l()
}
export const getTestTarget = () => testTarget

let testOn = false
let testPresses = 0
const testListeners = new Set<() => void>()
export function setTestState(on: boolean, presses: number) {
  if (on === testOn && presses === testPresses) return
  testOn = on
  testPresses = presses
  for (const l of testListeners) l()
}
export const getTestState = () => ({ on: testOn, presses: testPresses })
export const onTestState = (l: () => void) => {
  testListeners.add(l)
  return () => testListeners.delete(l)
}

const arrivalListeners = new Set<() => void>()
export const emitTestArrived = () => {
  for (const l of arrivalListeners) l()
}
export const onTestArrived = (l: () => void) => {
  arrivalListeners.add(l)
  return () => {
    arrivalListeners.delete(l)
  }
}

let testLanded = false
const testLandedListeners = new Set<() => void>()
export function setTestLanded(value: boolean) {
  if (value === testLanded) return
  testLanded = value
  for (const l of testLandedListeners) l()
}
export const useTestLanded = () =>
  useSyncExternalStore(
    (l) => {
      testLandedListeners.add(l)
      return () => testLandedListeners.delete(l)
    },
    () => testLanded,
    () => false,
  )
