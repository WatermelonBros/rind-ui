// The toaster and toast contracts (design §7): the region by its name, one toast by its
// title. Time is advanced through the environment (fake timers in tests).

import { contract } from "../../contract/contract"
import type { Env, Part } from "../../contract/env"
import type { SwipeDirection } from "../../dom/swipe"
import { toastMachine } from "./toast.machine"
import { toasterMachine } from "./toaster.machine"

type RegionP = "region" | "list" | "root"
type ToastP = "root" | "title" | "description" | "action-trigger" | "close-trigger"

const VECTOR: Record<SwipeDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Advances time in 100 ms steps until `done` (fake timers, or real waits), up to 30 s. */
async function waitOut<P extends string>(env: Env<P>, done: () => Promise<boolean>) {
  for (let t = 0; t < 30_000 && !(await done()); t += 100) await env.advance(100)
}

const toastsOf = (env: Env<RegionP>) => env.find({ role: "listitem" })

const regionHasFocus = async (env: Env<RegionP>) =>
  (await env.part("region").exists()) &&
  (await env.focused().exists()) &&
  (await env.focused().attr("data-scope")) === "toast"

/** The region of one store, located by its name ("Notifications (F6)"). */
export const toasterContract = contract("toast", {
  machine: toasterMachine,
  anatomy: ["region", "list", "root"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "region" as const, name }),
  queries: {
    /** Newest first. */
    titles: async (env: Env<RegionP>) => {
      const out: string[] = []
      for (const t of await toastsOf(env).all()) {
        if ((await t.attr("data-state")) === "open") out.push(await t.accessibleName())
      }
      return out
    },
    count: async (env: Env<RegionP>) => {
      let n = 0
      for (const t of await toastsOf(env).all()) if ((await t.attr("data-state")) === "open") n += 1
      return n
    },
    isExpanded: async (env: Env<RegionP>) =>
      (await env.part("region").exists()) &&
      (await env.part("region").attr("data-expanded")) !== null,
    isPaused: async (env: Env<RegionP>) =>
      (await env.part("region").exists()) &&
      (await env.part("region").attr("data-paused")) !== null,
    hasFocus: regionHasFocus,
  },
  actions: {
    /** Into the region: the hotkey (keyboard), a hover (pointer). */
    enter: {
      keyboard: async (env: Env<RegionP>) => env.keyboard("F6"),
      pointer: async (env: Env<RegionP>) => env.part("region").hover(),
      none: { touch: "touch has no hover; tap a toast's buttons instead" } as never,
      done: async (env: Env<RegionP>) =>
        (await regionHasFocus(env)) || (await env.part("region").attr("data-paused")) !== null,
    },
    /** Out of the region: the hotkey again, the pointer away. */
    leave: {
      keyboard: async (env: Env<RegionP>) => env.keyboard("F6"),
      pointer: async (env: Env<RegionP>) => env.pointerAway(),
      // With nothing remembered to return to, focus stays in the region (spec "Hotkey And
      // Focus"): the state checks decide.
      done: async () => true,
    },
    /** Advances time until no toast is shown. */
    waitForAll: {
      keyboard: async (env: Env<RegionP>) =>
        waitOut(env, async () => !(await env.part("region").exists())),
      done: async () => true,
    },
  },
  states: { collapsed: {}, expanded: {} },
  events: {
    "HOVER.START": "enter",
    "HOVER.END": "leave",
    "FOCUS.ENTER": "enter",
    "FOCUS.LEAVE": "leave",
    HOTKEY: "enter",
    SWIPING: { skip: "covered by the toast's swipe" },
    "VISIBLE.SYNC": { skip: "sent by the $props:visible edge" },
    "$props:visible": { skip: "the region stops rendering: store and machine tests" },
  },
  traits: ["timed", "presence"],
  // Focus in the region pauses and (by keyboard) expands: focusing it commits.
  commitsOnFocus: (["collapsed", "expanded"] as const).flatMap((state) =>
    (["region", "root"] as const).map((part) => ({ part, state })),
  ),
})

const closeTrigger = (env: Env<ToastP>): Part => env.part("close-trigger")

/** Exiting or removed: a removed toast's anchor no longer exists (that is the point). */
async function gone(env: Env<ToastP>): Promise<boolean> {
  try {
    return (await env.part("root").attr("data-state")) !== "open"
  } catch {
    return true
  }
}

/** One toast, located by its title. */
export const toastContract = contract("toast", {
  machine: toastMachine,
  anatomy: ["root", "title", "description", "action-trigger", "close-trigger"],
  locate: ({ name }: { readonly name: string | RegExp }) => ({ role: "listitem" as const, name }),
  queries: {
    isShown: async (env: Env<ToastP>) => !(await gone(env)),
    type: async (env: Env<ToastP>) => env.part("root").attr("data-type"),
    title: async (env: Env<ToastP>) =>
      (await env.part("title").exists()) ? env.part("title").text() : null,
    description: async (env: Env<ToastP>) =>
      (await env.part("description").exists()) ? env.part("description").text() : null,
    isPaused: async (env: Env<ToastP>) => (await env.part("root").attr("data-paused")) !== null,
    isLimited: async (env: Env<ToastP>) => (await env.part("root").attr("data-limited")) !== null,
    /** While it exits; null once removed. */
    dismissReason: async (env: Env<ToastP>) =>
      (await env.part("root").exists()) ? env.part("root").attr("data-dismiss-reason") : null,
  },
  actions: {
    /** The toast appears: the store starts it when its region mounts (nothing to do). */
    appear: {
      keyboard: async () => {},
      pointer: async () => {},
      done: async (env: Env<ToastP>) => !(await gone(env)),
    },
    /** The close trigger (pointer, touch); Escape on the focused toast (keyboard). */
    dismiss: {
      pointer: async (env: Env<ToastP>) => closeTrigger(env).click(),
      touch: async (env: Env<ToastP>) => closeTrigger(env).tap(),
      keyboard: async (env: Env<ToastP>) => {
        await env.part("root").focus()
        await env.keyboard("Escape")
      },
      done: (env: Env<ToastP>) => gone(env),
    },
    /** The shared drag input past the threshold. */
    swipe: {
      pointer: async (env: Env<ToastP>, direction: SwipeDirection = "right") => {
        const v = VECTOR[direction]
        await env.part("root").drag({ x: v.x * 120, y: v.y * 120 }, { pointerType: "mouse" })
      },
      touch: async (env: Env<ToastP>, direction: SwipeDirection = "right") => {
        const v = VECTOR[direction]
        await env.part("root").drag({ x: v.x * 120, y: v.y * 120 }, { pointerType: "touch" })
      },
      none: { keyboard: "dismiss (Escape) is its keyboard twin" },
      done: async () => true,
    },
    /** The action trigger. */
    act: {
      pointer: async (env: Env<ToastP>) => env.part("action-trigger").click(),
      keyboard: async (env: Env<ToastP>) => env.part("action-trigger").press("Enter"),
      done: async () => true,
    },
    hover: {
      pointer: async (env: Env<ToastP>) => env.part("root").hover(),
      keyboard: async (env: Env<ToastP>) => env.part("root").focus(),
      done: async () => true,
    },
    unhover: {
      pointer: async (env: Env<ToastP>) => env.pointerAway(),
      keyboard: async (env: Env<ToastP>) => env.keyboard("F6"),
      done: async () => true,
    },
    /** Advances its remaining time until it is gone. */
    waitForTimeout: {
      keyboard: async (env: Env<ToastP>) => waitOut(env, () => gone(env)),
      done: async () => true,
    },
  },
  states: {
    idle: { isShown: true },
    timing: { isShown: true },
    paused: { isShown: true },
    persistent: { isShown: true },
    dismissed: {},
  },
  events: {
    CLOSE_TRIGGER_PRESS: "dismiss",
    ESCAPE_KEY: "dismiss",
    ACTION_PRESS: "act",
    SWIPE: {
      action: "swipe",
      event: () => ({ direction: "right", offset: 120, velocity: 0.4, size: 300 }),
    },
    TIMEOUT: "waitForTimeout",
    START: "appear",
    PAUSE: { skip: "region-level and api reasons: the store tests" },
    RESUME: { skip: "region-level and api reasons: the store tests" },
    UPDATE: { skip: "api (toaster.update): the store tests" },
    DISMISS: { skip: "api (toaster.dismiss): the store tests" },
    MEASURED: { skip: "layout" },
    "SWIPE.START": { skip: "part of swipe" },
    "SWIPE.CANCEL": { skip: "the gesture's cancellation: swipe-gesture tests" },
  },
  traits: ["timed", "presence"],
  // Focus inside the region pauses every toast (spec "Pausing"): focusing a part commits.
  commitsOnFocus: (["timing", "paused", "persistent", "idle"] as const).flatMap((state) =>
    (["root", "action-trigger", "close-trigger"] as const).map((part) => ({ part, state })),
  ),
})
