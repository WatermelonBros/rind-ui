// The contract fragment every collection component spreads into its own contract: the
// collection anatomy, actions in every modality (keyboard always) and queries. Items are
// located by role and exact accessible name.

import type { AriaRole, Env } from "./env"

export type CollectionPart = "list" | "item" | "section" | "section-label"

export interface CollectionContractOptions {
  readonly itemRole: AriaRole
  /** Which key selects: Enter, Space, or both (Space first). Default "both". */
  readonly select?: "enter" | "space" | "both"
  /** How selection is exposed on items. Default `aria-selected`. */
  readonly selectionAttr?: "aria-selected" | "aria-checked" | "aria-pressed"
  /** Default vertical: ArrowDown moves next. */
  readonly orientation?: "vertical" | "horizontal"
  /**
   * How queries name an item. Default `text` (its text content); `accessible` for items that
   * hold labelled controls and are named by `aria-labelledby` (grid rows).
   */
  readonly naming?: "text" | "accessible"
}

export function collectionContract(o: CollectionContractOptions) {
  type E = Env<CollectionPart>
  const selectionAttr = o.selectionAttr ?? "aria-selected"
  const nextKey = o.orientation === "horizontal" ? "ArrowRight" : "ArrowDown"
  const item = (env: E, name: string) => env.part("item", { role: o.itemRole, name })
  /** Item names (text) whose element satisfies `test`. */
  const names = async (
    env: E,
    test: (attr: (n: string) => Promise<string | null>) => Promise<boolean>,
  ) => {
    const out: string[] = []
    for (const p of await env.part("item").all()) {
      if (await test((n) => p.attr(n))) {
        out.push(o.naming === "accessible" ? await p.accessibleName() : await p.text())
      }
    }
    return out
  }
  const highlighted = async (env: E) =>
    (await names(env, async (attr) => (await attr("data-highlighted")) !== null))[0] ?? null
  const selected = (env: E) => names(env, async (attr) => (await attr(selectionAttr)) === "true")

  /** Focus is on the list or one of its items (or an item is its active descendant). */
  const focusInside = async (env: E) => {
    if (await env.part("list").isFocused()) return true
    for (const p of await env.part("item").all()) if (await p.isFocused()) return true
    return false
  }
  const focusIn = async (env: E) => {
    if (!(await focusInside(env))) await env.part("list").focus()
  }

  /** Moves the highlight to `name` with the keyboard: focus in, Home, then arrows. */
  const arrowTo = async (env: E, name: string) => {
    if ((await highlighted(env)) === name && (await focusInside(env))) return
    await focusIn(env)
    if ((await highlighted(env)) === name) return
    await env.keyboard("Home")
    const count = await env.part("item").count()
    for (let i = 0; i < count && (await highlighted(env)) !== name; i++) {
      await env.keyboard(nextKey)
    }
  }
  const activate = async (env: E, options: { mod?: boolean } = {}) =>
    env.keyboard(o.select === "enter" ? "Enter" : "Space", options)

  return {
    anatomy: [
      "list",
      "item",
      "section",
      "section-label",
    ] as const satisfies readonly CollectionPart[],
    queries: {
      /** Item names in order. */
      items: (env: E) => names(env, async () => true),
      /** The highlighted item's name, or null. */
      highlighted,
      /** Selected item names, in order. */
      selected,
      /** Disabled item names, in order. */
      disabled: (env: E) => names(env, async (attr) => (await attr("aria-disabled")) === "true"),
      /** The focused item, or the `aria-activedescendant` of the focused element. */
      focusedItem: async (env: E) => {
        for (const p of await env.part("item").all())
          if (await p.isFocused()) {
            return o.naming === "accessible" ? p.accessibleName() : p.text()
          }
        return null
      },
    },
    actions: {
      highlight: {
        pointer: (env: E, name: string) => item(env, name).hover(),
        keyboard: arrowTo,
        done: async (env: E, name: string) => (await highlighted(env)) === name,
      },
      choose: {
        pointer: (env: E, name: string) => item(env, name).click(),
        touch: (env: E, name: string) => item(env, name).tap(),
        keyboard: async (env: E, name: string) => {
          await arrowTo(env, name)
          await activate(env)
        },
        done: async (env: E, name: string) => (await selected(env)).includes(name),
      },
      /** Adds or removes `name` (mod+press, mod+Space: toggles in replace behaviour too). */
      toggle: {
        pointer: (env: E, name: string) => item(env, name).click({ mod: true }),
        keyboard: async (env: E, name: string) => {
          await arrowTo(env, name)
          await env.keyboard("Space", { mod: true })
        },
        // Both paths leave `name` highlighted; the selection is checked against the oracle.
        done: async (env: E, name: string) => (await highlighted(env)) === name,
      },
      /** Selects `from`, then extends to `to` (Shift+press, or Shift+arrows). */
      chooseRange: {
        pointer: async (env: E, from: string, to: string) => {
          await item(env, from).click()
          await item(env, to).click({ shift: true })
        },
        keyboard: async (env: E, from: string, to: string) => {
          await arrowTo(env, from)
          await activate(env)
          const all = await names(env, async () => true)
          const forward = all.indexOf(to) > all.indexOf(from)
          const key = forward ? nextKey : nextKey === "ArrowDown" ? "ArrowUp" : "ArrowLeft"
          for (let i = 0; i < all.length && (await highlighted(env)) !== to; i++) {
            await env.keyboard(key, { shift: true })
          }
        },
        done: async (env: E, from: string, to: string) => {
          const sel = await selected(env)
          return sel.includes(from) && sel.includes(to)
        },
      },
      /** mod+A: everything enabled selected, or (already all) nothing. */
      selectAll: {
        keyboard: async (env: E) => {
          await focusIn(env)
          await env.keyboard("A", { mod: true })
        },
        done: async (env: E) => {
          const sel = await selected(env)
          const disabled = new Set(
            await names(env, async (attr) => (await attr("aria-disabled")) === "true"),
          )
          const enabled = (await names(env, async () => true)).filter((n) => !disabled.has(n))
          return sel.length === 0 || enabled.every((n) => sel.includes(n))
        },
      },
      /** Types `text`; when an item starts with it, that item ends up highlighted. */
      typeahead: {
        keyboard: async (env: E, text: string) => {
          await focusIn(env)
          await env.focused().type(text)
        },
        done: async (env: E, text: string) => {
          const starts = (n: string) =>
            n.slice(0, text.length).localeCompare(text, undefined, { sensitivity: "base" }) === 0
          const matches = (await names(env, async () => true)).some(starts)
          const h = await highlighted(env)
          return !matches || (h !== null && starts(h))
        },
      },
    },
  }
}
