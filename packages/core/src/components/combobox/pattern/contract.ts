// combobox-pattern "Pattern Contract": the queries, actions and announcement declarations
// every host spreads into its own contract. The keyboard is the input's; the options are
// reached through aria-activedescendant. Each host says how its open state reads.

import type { Env } from "../../../contract/env"
import { positioningQueries } from "../../../contract/positioning"
import type { PatternMessages } from "./machine"

type P = "input" | "item" | "list" | "positioner"
type E = Env<P>

const optionNames = async (
  env: E,
  test: (attr: (n: string) => Promise<string | null>) => Promise<boolean>,
) => {
  const out: string[] = []
  for (const p of await env.part("item").all()) {
    if ((await p.attr("role")) === "option" && (await test((n) => p.attr(n))))
      out.push(await p.text())
  }
  return out
}
const input = (env: E) => env.part("input")
const focusInput = async (env: E) => {
  if (!(await input(env).isFocused())) await input(env).focus()
}

/** What the announcement declarations read from the observed queries. */
type Observed = {
  readonly highlighted?: unknown
  readonly selected?: readonly unknown[] | undefined
  readonly items?: readonly unknown[] | undefined
  readonly inputValue?: unknown
}

/* @__NO_SIDE_EFFECTS__ */
export function patternContract(options: {
  /** The host's open state (not the listbox's exposure: open and empty is open). */
  readonly isOpen: (env: E) => Promise<boolean>
  /** A pointer gesture that opens the closed popup (a trigger press), if the host has one. */
  readonly openByPointer?: ((env: E) => Promise<void>) | undefined
  readonly messages: PatternMessages
}) {
  const { isOpen, messages } = options
  const highlighted = async (env: E) =>
    (await optionNames(env, async (a) => (await a("data-highlighted")) !== null))[0] ?? null
  /** Settled for pointer input: closed, empty (nothing to press), or open and placed. */
  const settled = async (env: E) =>
    !(await isOpen(env)) ||
    // A list in place: nothing to place.
    (await env.part("positioner").count()) === 0 ||
    (await input(env).attr("aria-expanded")) === "false" ||
    (await positioningQueries.isPlaced(env))
  /** Opens with ArrowDown if needed, then arrows until `name` is highlighted. */
  const arrowTo = async (env: E, name: string) => {
    await focusInput(env)
    if (!(await isOpen(env))) await input(env).press("ArrowDown")
    const count = await env.part("item").count()
    for (let i = 0; i <= count && (await highlighted(env)) !== name; i++) {
      await input(env).press("ArrowDown")
    }
  }
  const openPointer = options.openByPointer

  const queries = {
    ...positioningQueries,
    inputValue: (env: E) => input(env).value(),
    isOpen,
    /** Open with no options listed (the empty state). */
    isEmpty: async (env: E) =>
      (await isOpen(env)) && (await input(env).attr("aria-expanded")) === "false",
    isLoading: async (env: E) => (await env.part("list").attr("aria-busy")) === "true",
    /** Listed option names in order. */
    items: (env: E) => optionNames(env, async () => true),
    highlighted,
    /** Selected option names among the listed ones (the popup must be open). */
    selected: (env: E) => optionNames(env, async (a) => (await a("aria-selected")) === "true"),
    hasFocus: (env: E) => input(env).isFocused(),
  }

  const actions = {
    focusIn: {
      keyboard: async (env: E) => {
        if (!(await input(env).isFocused())) await input(env).focusWithTab()
      },
      done: { hasFocus: true },
    },
    type: {
      keyboard: async (env: E, text: string) => {
        await focusInput(env)
        await input(env).type(text)
      },
      done: async (env: E, text: string) =>
        (await input(env).value()).endsWith(text) && (await settled(env)),
    },
    compose: {
      keyboard: async (env: E, text: string, commit: boolean) => {
        await focusInput(env)
        await input(env).compose(
          [...text].map((_, i) => text.slice(0, i + 1)),
          commit ? text : undefined,
        )
      },
      done: async () => true,
    },
    close: { keyboard: (env: E) => input(env).press("Escape"), done: { isOpen: false } },
    // The model's keys go to whatever is focused (a key in an unfocused input is not real).
    arrowDown: { keyboard: (env: E) => env.keyboard("ArrowDown"), done: async () => true },
    arrowUp: { keyboard: (env: E) => input(env).press("ArrowUp"), done: async () => true },
    altArrowDown: {
      keyboard: (env: E) => input(env).press("ArrowDown", { alt: true }),
      done: async () => true,
    },
    caret: { keyboard: (env: E) => env.keyboard("ArrowRight"), done: async () => true },
    pressEnter: { keyboard: (env: E) => env.keyboard("Enter"), done: async () => true },
    pressEscape: { keyboard: (env: E) => env.keyboard("Escape"), done: async () => true },
    tabOut: { keyboard: (env: E) => env.keyboard("Tab"), done: { hasFocus: false } },
    blur: {
      pointer: (env: E) => env.pointerOutside(),
      none: { keyboard: "the keyboard blur is tabOut" },
      done: { hasFocus: false },
    },
    /**
     * One letter typed (the model's text change), as a committed composition: a composing
     * replay of plain typing would legitimately change the query (IME Composition).
     */
    typeR: {
      keyboard: async (env: E) => {
        await focusInput(env)
        await input(env).compose(["r"], "r")
      },
      done: settled,
    },
    clearText: {
      keyboard: async (env: E) => {
        await focusInput(env)
        await input(env).press("A", { mod: true })
        await input(env).press("Backspace")
      },
      done: async (env: E) => (await input(env).value()) === "",
    },
    /** Chooses the option `name`: a press on it, or arrows to it and Enter. */
    choose: {
      pointer: async (env: E, name: string) => {
        if (!(await isOpen(env))) {
          if (openPointer) await openPointer(env)
          else await arrowTo(env, name)
        }
        // An unplaced popup takes no pointer input yet.
        await env.until(() => settled(env), Boolean)
        await env.part("item", { role: "option", name }).click()
      },
      keyboard: async (env: E, name: string) => {
        await arrowTo(env, name)
        await input(env).press("Enter")
      },
      done: async () => true,
    },
  }

  /** `open()`'s keyboard half (ArrowDown); the host adds its pointer gesture or `none`. */
  const open = {
    keyboard: async (env: E) => {
      await focusInput(env)
      await input(env).press("ArrowDown")
    },
    done: async (env: E) => (await isOpen(env)) && (await settled(env)),
  }

  const announcements = {
    focusAnnouncement: (o: Observed) =>
      messages.focusAnnouncement(
        String(o.highlighted ?? ""),
        (o.selected ?? []).includes(String(o.highlighted ?? "")),
      ),
    countAnnouncement: (o: Observed) =>
      (o.items?.length ?? 0) === 0 ? messages.noResults : messages.count(o.items?.length ?? 0),
    selectionAnnouncement: (o: Observed) =>
      messages.selectedAnnouncement(String(o.inputValue ?? "")),
  }

  return { queries, actions, open, announcements, settled, highlighted, focusInput }
}
