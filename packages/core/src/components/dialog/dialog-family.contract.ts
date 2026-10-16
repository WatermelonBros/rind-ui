// The actions and queries every dialog-family contract shares (Dialog, Alert Dialog): one
// definition, so a fix reaches both (reka-ui#2702). Parts read: trigger, backdrop, content.

import type { Env } from "../../contract/env"

type E = Env<"trigger" | "backdrop" | "content">

/**
 * A dialog is located through its trigger (a closed dialog has no content to find):
 * `trigger` names it, defaulting to the dialog's `name` (the opening control usually
 * repeats it). `title()` reads the dialog's own name.
 */
export const dialogLocate = ({
  name,
  trigger,
}: {
  readonly name: string | RegExp
  readonly trigger?: string | RegExp
}) => ({ role: "button" as const, name: trigger ?? name })

export const dialogIsOpen = async (env: E) =>
  (await env.part("content").exists()) && (await env.part("content").attr("data-state")) === "open"
export const dialogHasFocus = async (env: E) =>
  (await env.part("content").exists()) &&
  (await env.part("content").attr("data-focus-within")) !== null

export const dialogFamilyQueries = {
  isOpen: dialogIsOpen,
  isModal: async (env: E) => (await env.part("content").attr("aria-modal")) === "true",
  title: async (env: E) =>
    (await env.part("content").exists()) ? env.part("content").accessibleName() : null,
  description: async (env: E) =>
    (await env.part("content").exists()) ? env.part("content").accessibleDescription() : null,
  hasFocus: dialogHasFocus,
  isTopmost: async (env: E) =>
    (await env.part("content").exists()) &&
    (await env.part("content").attr("data-has-nested")) === null,
  /** The last close reason, kebab case ("escape-key"), until the next open. */
  closeReason: async (env: E) => env.part("trigger").attr("data-close-reason"),
}

/** `outsideCloses`: an outside press closes it (a modal Dialog) or leaves it open (Alert). */
export const dialogFamilyActions = (outsideCloses: boolean) => ({
  open: {
    pointer: async (env: E) => env.part("trigger").click(),
    touch: async (env: E) => env.part("trigger").tap(),
    keyboard: async (env: E) => env.part("trigger").press("Enter"),
    // Open once focus has moved into it (within a frame).
    done: async (env: E) => (await dialogIsOpen(env)) && (await dialogHasFocus(env)),
  },
  pressEscape: {
    keyboard: async (env: E) => env.keyboard("Escape"),
    done: async (env: E) => !(await dialogIsOpen(env)),
  },
  pressOutside: {
    // The backdrop (a dismiss surface) near its corner, never its centre, where the
    // content sits; outside every layer when there is no backdrop.
    pointer: async (env: E) => {
      const backdrop = env.part("backdrop")
      if (await backdrop.exists()) await backdrop.pressAtPosition({ corner: true })
      else await env.pointerOutside()
    },
    none: { keyboard: "an outside press is a pointer interaction" },
    done: async (env: E) => (await dialogIsOpen(env)) !== outsideCloses,
  },
  tab: {
    keyboard: async (env: E) => env.keyboard("Tab"),
    done: dialogHasFocus,
  },
  shiftTab: {
    keyboard: async (env: E) => env.keyboard("Tab", { shift: true }),
    done: dialogHasFocus,
  },
  waitForUnmount: {
    keyboard: async (env: E) => env.part("content").waitForDetach(),
    done: async () => true,
  },
})
