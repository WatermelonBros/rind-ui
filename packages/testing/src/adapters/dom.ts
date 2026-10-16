// Testing Library adapter. Every interaction and every polling loop goes through Testing
// Library's configured asyncWrapper/eventWrapper, so framework flushing (React's act) comes
// from the framework's Testing Library package; this file has no framework code. Testing
// Library and user-event are optional peers, loaded on first use.

import {
  type By,
  type ClickOptions,
  KEY_DEBOUNCE_MS,
  type Key,
  type KeyOptions,
  type Part,
  PENDING_ANNOUNCEMENTS,
  tabbables,
} from "@rind-ui/core"
import { type AdapterEnv, describeBy, type EnvFactory, type EnvOptions, poll } from "../adapter"
import { installAnnouncementLog } from "../announcements"
import { collectDom, isVisible } from "../collect"
import { labelledControl } from "../labelled"
import { interceptNativeNavigation, navigatedSince, navigationLog } from "../navigation"
import { composeInPage } from "./compose"

/** The overlap of user-event's API and Vitest browser mode's `userEvent`. */
export interface UserLike {
  click(element: Element): Promise<unknown>
  hover(element: Element): Promise<unknown>
  keyboard(text: string): Promise<unknown>
  type(element: Element, text: string, options?: { skipClick?: boolean }): Promise<unknown>
  dblClick?(element: Element): Promise<unknown>
  /** user-event only; used for distinct coordinates and touch. */
  pointer?(actions: unknown): Promise<unknown>
}

export interface DomAdapterOptions {
  /** Defaults to document. Limits the anchor search; never limits parts (portals). */
  readonly root?: ParentNode
  /** user-event by default; pass `userEvent` from "vitest/browser" for real input. */
  readonly user?: UserLike
  /** Fake-timer advance, e.g. `vi.advanceTimersByTime`. */
  readonly advanceTimers?: (ms: number) => unknown
  /**
   * `until` timeout in ms. Default 1000 in jsdom (Testing Library's waitFor default) and
   * 3000 in a real browser, where a CPU-starved page can deliver its first animation frame
   * after more than a second (an overlay's initial focus waits for one).
   */
  readonly timeout?: number
}

type TL = typeof import("@testing-library/dom")
let tl: Promise<TL> | undefined
const loadTL = () => {
  tl ??= import("@testing-library/dom")
  return tl
}

// Successive synthetic pointer interactions get distinct coordinates (zag#3298: every
// synthetic pointer at 0,0 made pointer-move logic ignore the move), always inside the
// target, so hit tests against real layout (browser mode) still see the press on it.
let step = 0
const nextCoords = (el?: Element) => {
  step += 1
  const rect = el?.getBoundingClientRect()
  if (!rect || rect.width < 2 || rect.height < 2) {
    const c = step * 7
    return { clientX: c, clientY: c, pageX: c, pageY: c }
  }
  const x = rect.left + 1 + (step % Math.max(1, Math.floor(rect.width - 2)))
  const y = rect.top + 1 + (step % Math.max(1, Math.floor(rect.height - 2)))
  return { clientX: x, clientY: y, pageX: x + window.scrollX, pageY: y + window.scrollY }
}

/**
 * Resolves once no finite transition or animation is running in the document (or after `max`
 * ms). A sibling panel opening shifts the target's box for a while, and a press aimed at
 * coordinates read before the shift releases outside it (the press is then not a press).
 * Without running animations (every jsdom test, most browser ones) it returns at once; fake
 * timers have no frames to wait on.
 */
const settled = async (el: Element, fake: boolean, max = 1000) => {
  const doc = el.ownerDocument
  const view = doc.defaultView
  if (fake || !view?.requestAnimationFrame || !doc.getAnimations) return
  const running = () =>
    doc
      .getAnimations()
      .some(
        (a) =>
          a.playState === "running" &&
          a.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
      )
  const end = Date.now() + max
  while (running() && Date.now() < end) {
    await new Promise<void>((done) => view.requestAnimationFrame(() => done()))
  }
}

const KEY_NAMES: Record<Key, string> = {
  Enter: "{Enter}",
  Escape: "{Escape}",
  Space: "[Space]",
  Tab: "{Tab}",
  Home: "{Home}",
  End: "{End}",
  PageUp: "{PageUp}",
  PageDown: "{PageDown}",
  ArrowUp: "{ArrowUp}",
  ArrowDown: "{ArrowDown}",
  ArrowLeft: "{ArrowLeft}",
  ArrowRight: "{ArrowRight}",
  Backspace: "{Backspace}",
  Delete: "{Delete}",
  F10: "{F10}",
  ContextMenu: "{ContextMenu}",
  A: "a",
}

function keyText(key: Key, options: KeyOptions = {}, apple = false): string {
  const mods = [
    options.shift ? "Shift" : null,
    options.alt ? "Alt" : null,
    options.mod ? (apple ? "Meta" : "Control") : null,
  ].filter((m): m is string => m !== null)
  return `${mods.map((m) => `{${m}>}`).join("")}${KEY_NAMES[key]}${mods
    .reverse()
    .map((m) => `{/${m}}`)
    .join("")}`
}

const normalize = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()

const describeElement = (el: Element) => {
  const html = el.outerHTML
  return html.length > 160 ? `${html.slice(0, 160)}…` : html
}

const logs = new WeakMap<Window, string[]>()
/**
 * Records uncaught errors and console.error calls, installed once per window. Called by
 * `@rind-ui/testing/setup` and when a DOM adapter is created, so errors during the first
 * render are caught; `testMachine` clears it before each path.
 */
export function installErrorLog(win: Window | null = globalThis.window ?? null): string[] {
  if (!win) return []
  let log = logs.get(win)
  if (!log) {
    const entries: string[] = []
    // Every window has a console; the DOM lib only declares it on globalThis.
    const { console } = win as unknown as { console: Console }
    const original = console.error.bind(console)
    // In a real browser the user's resting cursor fires hover events on whatever renders
    // under it: React's act() warning for those is noise (act is jsdom's determinism tool),
    // not a component error. jsdom has no real input, so there it still counts.
    const realBrowser = !(win.navigator?.userAgent ?? "").includes("jsdom")
    console.error = (...args: unknown[]) => {
      const message = args.map(String).join(" ")
      if (!(realBrowser && message.includes("not wrapped in act("))) entries.push(message)
      original(...args)
    }
    win.addEventListener("error", (e) => entries.push(String(e.error ?? e.message)))
    logs.set(win, entries)
    log = entries
  }
  return log
}

const isJsdom = () => (globalThis.navigator?.userAgent ?? "").includes("jsdom")

/** The Testing Library adapter. */
export function domEnv(options: DomAdapterOptions = {}): EnvFactory {
  const timeout = options.timeout ?? (isJsdom() ? 1000 : 3000)
  const doc = (options.root as Node | undefined)?.ownerDocument ?? globalThis.document
  const errors = installErrorLog(doc?.defaultView ?? null)
  // Native link navigations are recorded and cancelled: the test page stays.
  if (doc?.defaultView) interceptNativeNavigation(doc.defaultView as Window & typeof globalThis)
  let user: Promise<UserLike> | undefined
  const getUser = () => {
    user ??= options.user
      ? Promise.resolve(options.user)
      : import("@testing-library/user-event").then(({ userEvent }) =>
          userEvent.setup(options.advanceTimers ? { advanceTimers: options.advanceTimers } : {}),
        )
    return user
  }
  return {
    "~rindEnvFactory": true,
    create: (envOptions) =>
      createDomEnv(envOptions, { ...options, timeout }, getUser, () => errors),
  }
}

/** React's flag for "updates must be inside act" (Testing Library's asyncWrapper clears it). */
const ACT_ENV = "IS_REACT_ACT_ENVIRONMENT"

/** The `key` value a native event carries for a contract key. */
const NATIVE_KEY: Partial<Record<Key, string>> = { Space: " " }

function createDomEnv(
  { scope, anchor, modality, platform }: EnvOptions,
  options: DomAdapterOptions & { readonly timeout: number },
  getUser: () => Promise<UserLike>,
  errors: () => string[],
): AdapterEnv {
  const doc = () => (options.root as Node | undefined)?.ownerDocument ?? document
  const apple = platform?.apple === true
  /** The navigation log's length when the current action began. */
  let navigationsFrom = navigationLog().length
  /** A composing key press: keydown and keyup with isComposing and keyCode 229, no input. */
  const composingPress = (el: Element, key: Key, keyOptions: KeyOptions) =>
    act(() => {
      for (const type of ["keydown", "keyup"] as const) {
        const e = new KeyboardEvent(type, {
          bubbles: true,
          cancelable: true,
          key: NATIVE_KEY[key] ?? key,
          isComposing: true,
          shiftKey: keyOptions.shift === true,
          altKey: keyOptions.alt === true,
          ctrlKey: keyOptions.mod === true && !apple,
          metaKey: keyOptions.mod === true && apple,
        })
        Object.defineProperty(e, "keyCode", { value: 229 })
        el.dispatchEvent(e)
      }
    })

  /** Wraps an interaction so the framework flushes (act) around it. */
  const act = async (fn: () => Promise<unknown> | unknown) => {
    const { getConfig } = await loadTL()
    await getConfig().asyncWrapper(async () => {
      const outside = Reflect.get(globalThis, ACT_ENV)
      let result: unknown
      getConfig().eventWrapper(() => {
        result = fn()
      })
      await result
      // user-event's own asyncWrapper started inside the act above: it saved "act
      // environment on" and restored that when it ended, out of order. Put back what this
      // wrapper set, or a later frame's update (a layer's initial focus) warns about act.
      if (outside === false) Reflect.set(globalThis, ACT_ENV, false)
    })
  }

  /** The whole loop runs inside asyncWrapper, so deferred updates never warn about act. */
  const until = async <T>(
    read: () => Promise<T>,
    accept: (value: T) => boolean,
    timeout = options.timeout,
  ) => {
    const { getConfig } = await loadTL()
    const { advanceTimers } = options
    const wait = advanceTimers
      ? (ms: number) => Promise.resolve(getConfig().eventWrapper(() => advanceTimers(ms)))
      : (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    return getConfig().asyncWrapper(() => poll(read, accept, { timeout, wait })) as Promise<T>
  }

  const queryBy = async (by: By, within: ParentNode): Promise<Element[]> => {
    if ("role" in by) {
      const { queryAllByRole } = await loadTL()
      const name = by.name
      // Exact names only: a string must equal the accessible name, never a substring.
      // Testing Library types the container as HTMLElement; it accepts any ParentNode.
      return queryAllByRole(within as HTMLElement, by.role, {
        ...(name === undefined
          ? {}
          : { name: typeof name === "string" ? (n: string) => normalize(n) === name : name }),
      })
    }
    if ("part" in by) {
      return Array.from(
        within.querySelectorAll(
          `[data-scope="${CSS.escape(scope)}"][data-part="${CSS.escape(by.part)}"]`,
        ),
      )
    }
    const { text } = by
    const matches = (el: Element) => {
      const own = normalize(el.textContent)
      return typeof text === "string" ? own === text : text.test(own)
    }
    // Deepest matches only, like Playwright's getByText: ancestors repeat the same text.
    const found = Array.from(within.querySelectorAll("*")).filter(matches)
    return found.filter((el) => !found.some((other) => other !== el && el.contains(other)))
  }

  const anchorEls = () => queryBy(anchor, options.root ?? doc())
  const instance = async () => {
    const els = await anchorEls()
    const [el, ...more] = els
    if (!el) throw new Error(`${scope}: no element matches the anchor (${describeBy(anchor)})`)
    if (more.length > 0) {
      throw new Error(
        `${scope}: ${els.length} elements match the anchor (${describeBy(anchor)}):\n${els.map(describeElement).join("\n")}`,
      )
    }
    const id = el.closest("[data-instance]")?.getAttribute("data-instance")
    if (!id) throw new Error(`${scope}: the anchor has no data-instance`)
    return id
  }

  /** A lazy handle: `resolve` runs on every use. Reads never wait; actions wait to exist. */
  const handle = (label: string, resolve: () => Promise<Element[]>): Part => {
    const single = (els: Element[]) => {
      if (els.length === 0) throw new Error(`${label}: not found`)
      if (els.length > 1) {
        throw new Error(
          `${label}: ${els.length} elements match:\n${els.map(describeElement).join("\n")}`,
        )
      }
      // Exactly one element, checked above.
      return els[0] as HTMLElement
    }
    const now = async () => single(await resolve())
    const waitFor = async () =>
      single(await until(resolve, (found) => found.length > 0).catch(async () => resolve()))
    const modifiers = (o: ClickOptions = {}) => ({
      shiftKey: o.shift === true,
      ctrlKey: o.mod === true && !apple,
      metaKey: o.mod === true && apple,
    })
    const bareClick = (el: Element, o?: ClickOptions) =>
      act(() =>
        el.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            composed: true,
            detail: 0,
            ...modifiers(o),
          }),
        ),
      )
    /** What a middle click sends (user-event and Vitest's userEvent differ on it). */
    const middleClick = (el: Element, o: ClickOptions) =>
      act(() => {
        const init = { bubbles: true, cancelable: true, composed: true, button: 1, buttons: 4 }
        const mods = modifiers(o)
        el.dispatchEvent(
          new PointerEvent("pointerdown", { ...init, ...mods, pointerType: "mouse" }),
        )
        el.dispatchEvent(new MouseEvent("mousedown", { ...init, ...mods }))
        el.dispatchEvent(
          new PointerEvent("pointerup", { ...init, ...mods, buttons: 0, pointerType: "mouse" }),
        )
        el.dispatchEvent(new MouseEvent("mouseup", { ...init, ...mods, buttons: 0 }))
        el.dispatchEvent(new MouseEvent("auxclick", { ...init, ...mods, buttons: 0, detail: 1 }))
      })
    /** Holds the modifiers (user-event keyboard state) around a press. */
    const held = async (o: ClickOptions | undefined, run: () => Promise<unknown>) => {
      const keys = [o?.shift ? "Shift" : null, o?.mod ? (apple ? "Meta" : "Control") : null].filter(
        (k): k is string => k !== null,
      )
      if (keys.length === 0) return run()
      const u = await getUser()
      await act(() => u.keyboard(keys.map((k) => `{${k}>}`).join("")))
      try {
        return await run()
      } finally {
        await act(() => u.keyboard(keys.map((k) => `{/${k}}`).join("")))
      }
    }
    const press = async (el: Element, touch: boolean) => {
      const u = await getUser()
      if (!u.pointer) return act(() => u.click(el))
      await settled(el, options.advanceTimers !== undefined)
      const coords = nextCoords(el)
      // Touch: no mouse pointer moves first, so hover logic never sees a tap.
      const steps = touch
        ? [{ keys: "[TouchA]", target: el, coords }]
        : [
            { target: el, coords },
            { keys: "[MouseLeft]", target: el, coords },
          ]
      return act(() => u.pointer?.(steps))
    }
    const part: Part = {
      async click(options) {
        const el = await waitFor()
        if (options?.button === "middle") return middleClick(el, options)
        if (modality === "virtual") return bareClick(el, options)
        await held(options, () => press(el, false))
      },
      async tap() {
        const el = await waitFor()
        return modality === "virtual" ? bareClick(el) : press(el, true)
      },
      async hover(hoverOptions) {
        const el = await waitFor()
        const pointerType = hoverOptions?.pointerType ?? "mouse"
        if (pointerType === "touch") {
          // What a finger landing on it sends: pointerover/enter with pointerType touch.
          return act(() => {
            for (const type of ["pointerover", "pointerenter"]) {
              el.dispatchEvent(
                new PointerEvent(type, {
                  bubbles: type === "pointerover",
                  pointerType,
                  ...nextCoords(el),
                }),
              )
            }
          })
        }
        const u = await getUser()
        if (u.pointer) await act(() => u.pointer?.({ target: el, coords: nextCoords(el) }))
        else await act(() => u.hover(el))
      },
      async focus() {
        const el = await waitFor()
        await act(() => el.focus())
      },
      async focusWithTab() {
        const el = await waitFor()
        const stops = tabbables(doc().body)
        const before = stops[stops.indexOf(el as HTMLElement) - 1]
        await act(() => {
          if (before) before.focus()
          else (doc().activeElement as HTMLElement | null)?.blur?.()
        })
        const u = await getUser()
        await act(() => u.keyboard("{Tab}"))
      },
      async press(key, keyOptions) {
        const el = await waitFor()
        if (doc().activeElement !== el) await act(() => el.focus())
        if (keyOptions?.composing) return composingPress(el, key, keyOptions)
        const u = await getUser()
        await act(() => u.keyboard(keyText(key, keyOptions, apple)))
      },
      async type(text) {
        const el = await waitFor()
        const u = await getUser()
        // A focused part that is not a text field is typed into without a click first (the
        // click would press it, e.g. select a listbox option). Text fields keep the click,
        // which puts the caret at the end.
        const textEntry =
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLElement && el.isContentEditable)
        const skipClick = doc().activeElement === el && !textEntry
        await act(() => u.type(el, text, skipClick ? { skipClick: true } : undefined))
      },
      async compose(updates, commit) {
        const el = await waitFor()
        if (doc().activeElement !== el) await act(() => el.focus())
        await act(() => composeInPage(el, commit === undefined ? { updates } : { updates, commit }))
      },
      async pressAtPosition(at) {
        const el = await waitFor()
        const rect = el.getBoundingClientRect()
        const x = at?.corner ? rect.left + 2 : rect.left + rect.width / 2
        const y = at?.corner ? rect.top + 2 : rect.top + rect.height / 2
        // Whatever is on top at that point (no layout in jsdom: the part itself).
        const hit = (rect.width > 0 ? doc().elementFromPoint(x, y) : null) ?? el
        const u = await getUser()
        if (u.pointer) {
          await act(() =>
            u.pointer?.([{ keys: "[MouseLeft]", target: hit, coords: { clientX: x, clientY: y } }]),
          )
        } else await act(() => u.click(hit))
      },
      box: async () => {
        const r = (await now()).getBoundingClientRect()
        // jsdom has no layout: every box is 0 × 0.
        return r.width === 0 && r.height === 0
          ? null
          : { x: r.x, y: r.y, width: r.width, height: r.height }
      },
      async pointer(phase, pointerOptions) {
        const el = await waitFor()
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) {
          throw new Error(
            `${label}: pointer("${phase}") needs layout, which this environment does not have`,
          )
        }
        const clientX = r.left + pointerOptions.at.x * r.width
        const clientY = r.top + pointerOptions.at.y * r.height
        const pointerType = pointerOptions.pointerType ?? "mouse"
        // A press reaches what is on top at that point, as a real pointer's would.
        const target = (phase === "down" ? doc().elementFromPoint(clientX, clientY) : null) ?? el
        const pressing = phase === "down" || phase === "move"
        const type = {
          down: "pointerdown",
          move: "pointermove",
          up: "pointerup",
          cancel: "pointercancel",
        }[phase]
        await act(() => {
          const init = {
            bubbles: true,
            cancelable: phase !== "cancel",
            composed: true,
            pointerId: pointerType === "mouse" ? 1 : 2,
            pointerType,
            isPrimary: true,
            clientX,
            clientY,
            button: phase === "move" ? -1 : 0,
            buttons: pressing ? 1 : 0,
            pressure: pressing ? 0.5 : 0,
          }
          const event = new PointerEvent(type, init)
          target.dispatchEvent(event)
          // A mouse's compatibility events (none after a prevented pointerdown, per spec).
          if (pointerType === "mouse" && phase !== "cancel" && !event.defaultPrevented) {
            const mouse = { down: "mousedown", move: "mousemove", up: "mouseup" }[phase]
            target.dispatchEvent(
              new MouseEvent(mouse, { ...init, detail: phase === "move" ? 0 : 1 }),
            )
          }
        })
      },
      async fill(value) {
        const el = await waitFor()
        await act(() => {
          const input = el as HTMLInputElement
          // The prototype's setter, so a framework's value tracker sees a real change.
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set
          if (setter) setter.call(input, value)
          else input.value = value
          input.dispatchEvent(new Event("input", { bubbles: true }))
          input.dispatchEvent(new Event("change", { bubbles: true }))
        })
      },
      waitForDetach: async () => {
        await until(
          async () => (await resolve()).length,
          (n) => n === 0,
        )
      },
      isInert: async () => (await now()).closest("[inert]") !== null,
      attr: async (name) => (await now()).getAttribute(name),
      tagName: async () => (await now()).tagName.toLowerCase(),
      scoped: (scope, partName) =>
        handle(`${scope}.${partName} in ${label}`, async () =>
          Array.from(
            (await now()).querySelectorAll(`[data-scope="${scope}"][data-part="${partName}"]`),
          ),
        ),
      withAttr: (name, value) =>
        handle(`[${name}] in ${label}`, async () =>
          Array.from(
            (await now()).querySelectorAll(
              value === undefined ? `[${name}]` : `[${name}="${CSS.escape(value)}"]`,
            ),
          ),
        ),
      text: async () => normalize((await now()).textContent),
      value: async () => ((await now()) as HTMLInputElement).value ?? "",
      checked: async () => ((await now()) as HTMLInputElement).checked === true,
      indeterminate: async () => ((await now()) as HTMLInputElement).indeterminate === true,
      exists: async () => (await resolve()).some(isVisible),
      isFocused: async () => {
        const el = await now()
        const active = doc().activeElement
        return (
          active === el || (el.id !== "" && active?.getAttribute("aria-activedescendant") === el.id)
        )
      },
      count: async () => (await resolve()).length,
      accessibleName: async () => {
        const { computeAccessibleName } = await import("dom-accessibility-api")
        return normalize(computeAccessibleName(await now()))
      },
      accessibleDescription: async () => {
        const { computeAccessibleDescription } = await import("dom-accessibility-api")
        return normalize(computeAccessibleDescription(await now()))
      },
      labelled: () =>
        handle(`the control of ${label}`, async () => {
          const control = labelledControl(await now())
          return control ? [control] : []
        }),
      async doubleClick() {
        const el = await waitFor()
        const u = await getUser()
        if (u.dblClick) await act(() => u.dblClick?.(el))
        else {
          await press(el, false)
          await press(el, false)
        }
      },
      nth: (index) =>
        handle(`${label}[${index}]`, async () => {
          const el = (await resolve())[index]
          return el ? [el] : []
        }),
      all: async () => (await resolve()).map((_, i) => part.nth(i)),
    }
    return part
  }

  const partEls = async (name: string, by?: By) => {
    const id = await instance()
    const sel = `[data-scope="${CSS.escape(scope)}"][data-part="${CSS.escape(name)}"][data-instance="${CSS.escape(id)}"]`
    const parts = Array.from(doc().querySelectorAll(sel))
    if (!by) return parts
    const matching = new Set(await queryBy(by, doc()))
    return parts.filter((el) => matching.has(el))
  }

  return {
    modality,
    part: (name, by) =>
      handle(`${scope}.${name}${by ? ` (${describeBy(by)})` : ""}`, () => partEls(name, by)),
    find: (by) => handle(describeBy(by), () => queryBy(by, doc())),
    focused: () =>
      handle("the focused element", async () => {
        const active = doc().activeElement
        return active && active !== doc().body ? [active] : []
      }),
    async keyboard(key: Key, keyOptions?: KeyOptions) {
      const target = doc().activeElement ?? doc().body
      if (keyOptions?.composing) return composingPress(target, key, keyOptions)
      const u = await getUser()
      await act(() => u.keyboard(keyText(key, keyOptions, apple)))
    },
    async pointerOutside() {
      const u = await getUser()
      const body = doc().body
      if (!u.pointer) return act(() => u.click(body))
      const coords = nextCoords()
      await act(() => u.pointer?.([{ keys: "[MouseLeft]", target: body, coords }]))
    },
    until,
    advance: async (ms) => {
      if (options.advanceTimers) await act(() => options.advanceTimers?.(ms))
      else await act(() => new Promise((resolve) => setTimeout(resolve, Math.max(ms, 16))))
    },
    instance,
    anchorCount: async () => (await anchorEls()).length,
    collect: async () => collectDom({ scope, instance: await instance() }),
    // No instance matches this id: only the document-wide fields are filled.
    collectDocument: async () => collectDom({ scope, instance: "\u0000unmounted" }),
    announcements: async () => {
      // Keyed messages are spoken after their debounce: wait until none is pending.
      await until(
        async () => (Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) as number | undefined) ?? 0,
        (n) => n === 0,
        Math.max(options.timeout, KEY_DEBOUNCE_MS * 2),
      ).catch(() => {})
      return [...installAnnouncementLog()]
    },
    takeErrors: async () => errors().splice(0),
    holdAnimations: async () => {
      const running =
        doc()
          .getAnimations?.()
          .filter((a) => a.playState === "running") ?? []
      for (const a of running) a.pause()
      return async () => {
        for (const a of running) if (a.playState === "paused") a.play()
      }
    },
    selectedText: async () => doc().getSelection()?.toString() ?? "",
    markNavigations: async () => {
      navigationsFrom = navigationLog().length
    },
    navigated: async (o) => navigatedSince(navigationLog(), navigationsFrom, o),
    scope: async (fn) => (await loadTL()).getConfig().asyncWrapper(fn) as ReturnType<typeof fn>,
    setDirection: async (direction) => {
      if (direction === null) doc().documentElement.removeAttribute("dir")
      else doc().documentElement.dir = direction
    },
  }
}
