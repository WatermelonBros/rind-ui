// Playwright adapter. Imports Playwright's types only: it calls methods on the objects it
// is given, so a project without Playwright installed can still load @rind-ui/testing.
// Names, visibility and DOM snapshots are computed in the page by the same code the DOM
// adapter imports (`dist/inpage.iife.js`, injected once per document).

import type { Announcement, By, ClickOptions, Key, KeyOptions, Part } from "@rind-ui/core"
import type { Frame, FrameLocator, Locator, Page } from "playwright"
import { type AdapterEnv, describeBy, type EnvFactory, type EnvOptions, poll } from "../adapter"
import type { DomSnapshot } from "../collect"
import type { InPage } from "../inpage"
import { type AxNode, axNodeOf } from "./chromium-tree"
import { composeInPage } from "./compose"

export type PlaywrightTarget = Page | Locator | FrameLocator

export interface PlaywrightAdapterOptions {
  /** `until` timeout in ms (default 5000, Playwright's expect timeout). */
  readonly timeout?: number
  /** Advances time when the page uses `page.clock`; defaults to waiting. */
  readonly advanceTimers?: (ms: number) => Promise<unknown>
}

const PW_KEYS: Record<Key, string> = {
  Enter: "Enter",
  Escape: "Escape",
  Space: " ",
  Tab: "Tab",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Backspace: "Backspace",
  Delete: "Delete",
  F10: "F10",
  ContextMenu: "ContextMenu",
  A: "a",
}
const keyName = (key: Key, o: KeyOptions = {}, apple?: boolean) =>
  [
    o.shift && "Shift",
    o.alt && "Alt",
    o.mod && (apple === undefined ? "ControlOrMeta" : apple ? "Meta" : "Control"),
    PW_KEYS[key],
  ]
    .filter(Boolean)
    .join("+")

/** In the page: keydown and keyup with isComposing and keyCode 229 on `el`. */
const composingKeys = (
  el: Element,
  init: { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean },
) => {
  for (const type of ["keydown", "keyup"]) {
    const e = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      isComposing: true,
      ...init,
    })
    Object.defineProperty(e, "keyCode", { value: 229 })
    el.dispatchEvent(e)
  }
}

let inpageSource: Promise<string> | undefined
/** The in-page bundle, read once from next to this module (dist) or from the built package. */
function loadInPage(): Promise<string> {
  inpageSource ??= (async () => {
    // node:fs is only reached in Node, where Playwright runs; typed here so the package
    // needs no Node types. The dynamic specifier keeps bundlers from inlining it.
    const fs = (await import("node:fs/promises" as string)) as {
      readFile(path: URL, encoding: "utf8"): Promise<string>
    }
    for (const candidate of ["./inpage.iife.js", "../../dist/inpage.iife.js"]) {
      try {
        return await fs.readFile(new URL(candidate, import.meta.url), "utf8")
      } catch {}
    }
    throw new Error("rind-ui: dist/inpage.iife.js is missing; build @rind-ui/testing")
  })()
  return inpageSource
}

/** Window plus the in-page module, for functions that run in the page. */
type InPageWindow = typeof globalThis & { __rindTesting?: InPage }

async function ensureInPage(root: Page | Frame) {
  const present = await root.evaluate(() => "__rindTesting" in globalThis)
  if (!present) await root.evaluate(await loadInPage())
}

interface Base {
  readonly page: Page
  /** The frame or page parts live in: portals stay inside it, so never limit further. */
  readonly root: Page | Frame
  /** Where the anchor is searched: the target itself for a Locator. */
  readonly anchorRoot: Page | Frame | Locator
}

/** A Playwright Page, by duck typing (no runtime import). */
export const isPage = (t: unknown): t is Page =>
  typeof t === "object" && t !== null && "mainFrame" in t && "on" in t

async function baseOf(target: PlaywrightTarget): Promise<Base> {
  if (isPage(target)) return { page: target, root: target, anchorRoot: target }
  // Locator and FrameLocator overlap structurally; only Locator has `page()`.
  if ("page" in target) {
    const locator = target as Locator
    const handle = await locator.elementHandle()
    const frame = (await handle?.ownerFrame()) ?? locator.page().mainFrame()
    return { page: frame.page(), root: frame, anchorRoot: locator }
  }
  const owner = await (target as FrameLocator).owner().elementHandle()
  const frame = await owner?.contentFrame()
  if (!frame) throw new Error("rind-ui: the FrameLocator's frame is not attached")
  return { page: frame.page(), root: frame, anchorRoot: frame }
}

const logged = new WeakSet<Page>()
/** Records every announcement in the page, from its first script on (and on the current page). */
async function installPageAnnouncementLog(page: Page) {
  if (logged.has(page)) return
  logged.add(page)
  const install = () => {
    const key = Symbol.for("rind-ui.announcements")
    if (!Reflect.get(globalThis, key)) Reflect.set(globalThis, key, [])
  }
  await page.addInitScript(install)
  await page.evaluate(install).catch(() => {})
}

const errorLogs = new WeakMap<Page, string[]>()
/** Records the page's uncaught errors and console.error calls; installed once per page. */
export function watchPageErrors(page: Page): string[] {
  let log = errorLogs.get(page)
  if (!log) {
    const entries: string[] = []
    page.on("pageerror", (e) => entries.push(String(e)))
    page.on("console", (m) => {
      if (m.type() === "error") entries.push(m.text())
    })
    errorLogs.set(page, entries)
    log = entries
  }
  return log
}

/** The Playwright adapter. */
export function playwrightEnv(
  target: PlaywrightTarget,
  options: PlaywrightAdapterOptions = {},
): EnvFactory {
  let base: Promise<Base> | undefined
  // Installed when the factory is created, before the test interacts with the page.
  const getBase = () => {
    base ??= baseOf(target).then(async (b) => {
      watchPageErrors(b.page)
      await installPageAnnouncementLog(b.page)
      return b
    })
    return base
  }
  if (isPage(target)) {
    watchPageErrors(target)
    void installPageAnnouncementLog(target)
  }
  return {
    "~rindEnvFactory": true,
    create: (envOptions) => createPlaywrightEnv(getBase, envOptions, options),
  }
}

function createPlaywrightEnv(
  getBase: () => Promise<Base>,
  { scope, anchor, modality, platform }: EnvOptions,
  options: PlaywrightAdapterOptions,
): AdapterEnv {
  const apple = platform?.apple
  const composingInit = (key: Key, o: KeyOptions = {}) => ({
    key: key === "Space" ? " " : key,
    shiftKey: o.shift === true,
    altKey: o.alt === true,
    ctrlKey: o.mod === true && apple !== true,
    metaKey: o.mod === true && apple === true,
  })
  const timeout = options.timeout ?? 5000
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const until = <T>(read: () => Promise<T>, accept: (value: T) => boolean) =>
    poll(read, accept, { timeout, wait })

  // Exact names: Playwright matches substrings unless `exact: true`.
  const byLocator = (root: Page | Frame | Locator, by: By): Locator =>
    "role" in by
      ? root.getByRole(by.role as Parameters<Page["getByRole"]>[0], {
          ...(by.name === undefined ? {} : { name: by.name, exact: true }),
        })
      : root.getByText(by.text, { exact: true })

  const describeAll = (l: Locator) =>
    l.evaluateAll((els) => els.map((el) => el.outerHTML.slice(0, 160)).join("\n"))

  /** What tells a navigation: the URL, the open pages, and the in-page log (fakeRouter). */
  const navigationState = async () => {
    const { page, root } = await getBase()
    const log = await root
      .evaluate(() =>
        (
          (Reflect.get(globalThis, Symbol.for("rind-ui.navigations")) as
            | { readonly newTab: boolean }[]
            | undefined) ?? []
        ).map((n) => n.newTab),
      )
      .catch((): boolean[] => [])
    return { url: page.url(), pages: page.context().pages().length, log }
  }
  let navigationsFrom: Awaited<ReturnType<typeof navigationState>> | undefined

  const anchorLocator = async () => byLocator((await getBase()).anchorRoot, anchor)
  const instance = async () => {
    const a = await anchorLocator()
    const n = await a.count()
    if (n === 0) throw new Error(`${scope}: no element matches the anchor (${describeBy(anchor)})`)
    if (n > 1) {
      throw new Error(
        `${scope}: ${n} elements match the anchor (${describeBy(anchor)}):\n${await describeAll(a)}`,
      )
    }
    const id = await a.evaluate((el) =>
      el.closest("[data-instance]")?.getAttribute("data-instance"),
    )
    if (!id) throw new Error(`${scope}: the anchor has no data-instance`)
    return id
  }

  /** A lazy handle. Reads never wait; actions wait for the element to exist. */
  const handle = (label: string, locate: () => Promise<Locator>): Part => {
    const single = async (l: Locator) => {
      const n = await l.count()
      if (n === 0) throw new Error(`${label}: not found`)
      if (n > 1) throw new Error(`${label}: ${n} elements match:\n${await describeAll(l)}`)
      return l
    }
    const now = async () => single(await locate())
    const waitFor = async () => {
      const l = await locate()
      await until(
        () => l.count(),
        (n) => n > 0,
      ).catch(() => 0)
      return single(l)
    }
    const activate = async (touch: boolean, o: ClickOptions = {}) => {
      const l = await waitFor()
      const mods = [
        o.shift ? ("Shift" as const) : null,
        o.mod
          ? apple === undefined
            ? ("ControlOrMeta" as const)
            : apple
              ? ("Meta" as const)
              : ("Control" as const)
          : null,
      ].filter((m) => m !== null)
      // Assistive technology activates with a bare click: detail 0, nothing before it.
      if (modality === "virtual") {
        return l.dispatchEvent("click", {
          detail: 0,
          shiftKey: o.shift === true,
          ctrlKey: o.mod === true && !apple,
          metaKey: o.mod === true && apple,
        })
      }
      // A user can press an aria-disabled part; Playwright would wait for it to be enabled.
      const force = (await l.getAttribute("aria-disabled")) === "true"
      if (o.button === "middle") return l.click({ button: "middle", modifiers: mods, force })
      return touch ? l.tap({ modifiers: mods, force }) : l.click({ modifiers: mods, force })
    }
    const part: Part = {
      click: (options) => activate(false, options),
      tap: () => activate(true),
      hover: async (hoverOptions) => {
        const l = await waitFor()
        if (hoverOptions?.pointerType !== "touch") return l.hover()
        await l.dispatchEvent("pointerover", { pointerType: "touch", bubbles: true })
        await l.dispatchEvent("pointerenter", { pointerType: "touch" })
      },
      focus: async () => (await waitFor()).focus(),
      async press(key, keyOptions) {
        const l = await waitFor()
        if (!(await l.evaluate((el) => el === document.activeElement))) await l.focus()
        if (keyOptions?.composing) {
          await l.evaluate(composingKeys, composingInit(key, keyOptions))
          return
        }
        await l.press(keyName(key, keyOptions, apple))
      },
      async type(text) {
        const l = await waitFor()
        // Like the DOM adapter (and a click on a text field): the caret goes to the end, so
        // text is appended; a script-focused input otherwise has its caret at 0.
        await l.evaluate((el) => {
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.ownerDocument.activeElement !== el) el.focus()
            const end = el.value.length
            try {
              el.setSelectionRange(end, end)
            } catch {
              // Input types without a selection (number, email): the caret cannot be placed.
            }
          } else if (el instanceof HTMLElement && el.isContentEditable) {
            el.focus()
            const range = el.ownerDocument.createRange()
            range.selectNodeContents(el)
            range.collapse(false)
            el.ownerDocument.getSelection()?.removeAllRanges()
            el.ownerDocument.getSelection()?.addRange(range)
          }
        })
        await l.pressSequentially(text)
      },
      async compose(updates, commit) {
        const l = await waitFor()
        if (!(await l.evaluate((el) => el === document.activeElement))) await l.focus()
        const { page } = await getBase()
        if (page.context().browser()?.browserType().name() === "chromium") {
          // The real IME path: Chromium fires the composition and input events itself.
          const cdp = await page.context().newCDPSession(page)
          // An IME's key per update: keyCode 229 ("Process"), as a real composition sends.
          const imeKey = (type: "rawKeyDown" | "keyUp") =>
            cdp.send("Input.dispatchKeyEvent", {
              type,
              key: "Process",
              code: "",
              windowsVirtualKeyCode: 229,
              nativeVirtualKeyCode: 229,
            })
          for (const text of updates) {
            await imeKey("rawKeyDown")
            await cdp.send("Input.imeSetComposition", {
              text,
              selectionStart: text.length,
              selectionEnd: text.length,
            })
            await imeKey("keyUp")
          }
          // Without a commit the composition stays open in Chromium too.
          if (commit !== undefined) await cdp.send("Input.insertText", { text: commit })
          await cdp.detach()
          return
        }
        await l.evaluate(composeInPage, commit === undefined ? { updates } : { updates, commit })
      },
      async pressAtPosition() {
        const l = await waitFor()
        const box = await l.boundingBox()
        if (!box) throw new Error("pressAtPosition: the part has no box")
        // The real mouse at that point: the press reaches whatever is on top there.
        const { page } = await getBase()
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      },
      waitForDetach: async () => {
        await until(
          async () => (await locate()).count(),
          (n) => n === 0,
        )
      },
      isInert: async () => (await now()).evaluate((el) => el.closest("[inert]") !== null),
      attr: async (name) => (await now()).getAttribute(name),
      tagName: async () => (await now()).evaluate((el) => el.tagName.toLowerCase()),
      scoped: (scope, partName) =>
        handle(`${scope}.${partName} in ${label}`, async () =>
          (await now()).locator(`[data-scope="${scope}"][data-part="${partName}"]`),
        ),
      accessibleName: async () => {
        const { root } = await getBase()
        await ensureInPage(root)
        return (await now()).evaluate(
          (el) => (globalThis as InPageWindow).__rindTesting?.accessibleName(el) ?? "",
        )
      },
      accessibleDescription: async () => {
        const { root } = await getBase()
        await ensureInPage(root)
        return (await now()).evaluate(
          (el) => (globalThis as InPageWindow).__rindTesting?.accessibleDescription(el) ?? "",
        )
      },
      labelled: () =>
        handle(`the control of ${label}`, async () => {
          const text = ((await (await now()).textContent()) ?? "").replace(/\s+/g, " ").trim()
          return (await getBase()).root.getByLabel(text, { exact: true })
        }),
      doubleClick: async () => (await waitFor()).dblclick(),
      text: async () => ((await (await now()).textContent()) ?? "").replace(/\s+/g, " ").trim(),
      value: async () => (await now()).inputValue(),
      // Properties, not attributes (the attribute is the default a reset restores).
      checked: async () =>
        (await now()).evaluate((el) => (el as HTMLInputElement).checked === true),
      indeterminate: async () =>
        (await now()).evaluate((el) => (el as HTMLInputElement).indeterminate === true),
      exists: async () => {
        await ensureInPage((await getBase()).root)
        return (await locate()).evaluateAll((els) =>
          els.some((el) => (globalThis as InPageWindow).__rindTesting?.isVisible(el) === true),
        )
      },
      isFocused: async () =>
        (await now()).evaluate((el) => {
          const active = document.activeElement
          return (
            active === el ||
            (el.id !== "" && active?.getAttribute("aria-activedescendant") === el.id)
          )
        }),
      count: async () => (await locate()).count(),
      nth: (index) => handle(`${label}[${index}]`, async () => (await locate()).nth(index)),
      all: async () => {
        const n = await (await locate()).count()
        return Array.from({ length: n }, (_, i) => part.nth(i))
      },
    }
    return part
  }

  const partLocator = async (name: string, by?: By) => {
    const { root } = await getBase()
    const id = await instance()
    const parts = root.locator(
      `[data-scope="${scope}"][data-part="${name}"][data-instance="${id}"]`,
    )
    return by ? parts.and(byLocator(root, by)) : parts
  }

  return {
    modality,
    part: (name, by) =>
      handle(`${scope}.${name}${by ? ` (${describeBy(by)})` : ""}`, () => partLocator(name, by)),
    find: (by) => handle(describeBy(by), async () => byLocator((await getBase()).root, by)),
    focused: () =>
      handle("the focused element", async () =>
        (await getBase()).root.locator("*:focus:not(body)"),
      ),
    async keyboard(key, keyOptions) {
      if (keyOptions?.composing) {
        const focused = (await getBase()).root.locator("*:focus")
        await focused.evaluate(composingKeys, composingInit(key, keyOptions))
        return
      }
      await (await getBase()).page.keyboard.press(keyName(key, keyOptions, apple))
    },
    async pointerOutside() {
      // The corner of the target's own document (a frame's body for frame targets).
      await (await getBase()).root.locator("body").click({ position: { x: 1, y: 1 }, force: true })
    },
    until,
    advance: async (ms) => {
      if (options.advanceTimers) await options.advanceTimers(ms)
      else await (await getBase()).page.waitForTimeout(Math.max(ms, 16))
    },
    instance,
    anchorCount: async () => (await anchorLocator()).count(),
    selectedText: async () =>
      (await getBase()).root.evaluate(() => globalThis.getSelection()?.toString() ?? ""),
    markNavigations: async () => {
      navigationsFrom = await navigationState()
    },
    navigated: async (o) => {
      const now = await navigationState()
      const from = navigationsFrom ?? { ...now, log: [] }
      const newTab = o?.newTab === true
      // A document navigation replaces the page's log: the URL tells it then.
      if (now.log.slice(from.log.length).some((t) => t === newTab)) return true
      return newTab ? now.pages > from.pages : now.url !== from.url
    },
    collectDocument: async () => {
      const { root } = await getBase()
      await ensureInPage(root)
      // No instance matches this id: only the document-wide fields are filled.
      return root.evaluate(
        (a) => (globalThis as InPageWindow).__rindTesting?.collectDom(a) as DomSnapshot,
        { scope, instance: "\u0000unmounted" },
      )
    },
    collect: async () => {
      const { root } = await getBase()
      await ensureInPage(root)
      const arg = { scope, instance: await instance() }
      return root.evaluate(
        (a) => (globalThis as InPageWindow).__rindTesting?.collectDom(a) as DomSnapshot,
        arg,
      )
    },
    announcements: async () => {
      const { root } = await getBase()
      // Keyed messages are spoken after their debounce: wait until none is pending.
      await poll(
        () =>
          root.evaluate(
            () =>
              (Reflect.get(globalThis, Symbol.for("rind-ui.announcements.pending")) as
                | number
                | undefined) ?? 0,
          ),
        (n) => n === 0,
        { timeout: 1000, wait: (ms) => new Promise((r) => setTimeout(r, ms)) },
      ).catch(() => {})
      return root.evaluate(() => [
        ...((Reflect.get(globalThis, Symbol.for("rind-ui.announcements")) as
          | Announcement[]
          | undefined) ?? []),
      ])
    },
    takeErrors: async () => watchPageErrors((await getBase()).page).splice(0),
    chromiumChecks: async () => {
      const { page, root } = await getBase()
      /**
       * The node, polled until it exists and shows no issue (the tree updates after the DOM),
       * then read once more: null when it never existed within the timeout.
       */
      const settledNode = async (
        expression: string,
        issues: (node: AxNode) => readonly string[],
      ): Promise<AxNode | "unavailable" | null> => {
        const read = () => axNodeOf(page, expression)
        const last = await until(
          read,
          (n) => n !== null && ("unavailable" in n || issues(n).length === 0),
        ).catch(read)
        if (last === null) return null
        return "unavailable" in last ? "unavailable" : last
      }
      // Frames are not inspected through the page's CDP session.
      if (root !== page) return "unavailable"
      await ensureInPage(page)
      const id = await instance()
      const snap = await page.evaluate(
        (a) => (globalThis as InPageWindow).__rindTesting?.collectDom(a) as DomSnapshot,
        { scope, instance: id },
      )
      const partsSelector = JSON.stringify(
        `[data-scope="${scope}"][data-instance="${id}"][data-part]`,
      )
      const problems: string[] = []
      const exposedNow = (el: DomSnapshot["parts"][number]) =>
        !el.hidden && !el.inAriaHidden && !el.inInert
      for (const [i, el] of snap.parts.entries()) {
        if (!exposedNow(el)) continue
        const expression = `document.querySelectorAll(${partsSelector})[${i}]`
        const labelled = el.attrs["aria-labelledby"] !== undefined && el.name !== ""
        const described = el.attrs["aria-describedby"] !== undefined && el.description !== ""
        const popup = ["dialog", "alertdialog", "menu", "listbox", "tree", "grid"].includes(
          el.role ?? "",
        )
        if (!labelled && !described && !popup) continue
        const issues = (node: AxNode) => [
          ...(labelled && node.name === ""
            ? [
                `${el.describe}: Chromium computes no name (aria-labelledby target inert or ignored? RA#9737); in-page name "${el.name}"`,
              ]
            : []),
          ...(described && node.description === ""
            ? [`${el.describe}: Chromium drops the description (target ignored? RA#8915)`]
            : []),
          ...(popup && node.ignored
            ? [
                `${el.describe}: open popup is ignored by Chromium (${node.ignoredReasons.join(", ")}; RX#4115)`,
              ]
            : []),
        ]
        const node = await settledNode(expression, issues)
        if (node === "unavailable") return "unavailable"
        if (node === null) {
          problems.push(`${el.describe}: Chromium's accessibility node never became available`)
          continue
        }
        problems.push(...issues(node))
      }
      if (snap.focus.element) {
        const focused = snap.focus.element
        const issues = (node: AxNode) =>
          node.ignored
            ? [
                `the focused ${focused.describe} is ignored by Chromium (${node.ignoredReasons.join(", ")})`,
              ]
            : []
        const node = await settledNode("document.activeElement", issues)
        if (node === null) {
          problems.push(`the focused ${focused.describe}: Chromium's node never became available`)
        } else if (node !== "unavailable") problems.push(...issues(node))
      }
      return problems
    },
    setDirection: async (direction) => {
      await (await getBase()).root.evaluate((dir) => {
        if (dir === null) document.documentElement.removeAttribute("dir")
        else document.documentElement.dir = dir
      }, direction)
    },
  }
}
