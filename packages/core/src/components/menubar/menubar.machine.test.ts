// The Menubar machine in Node (openspec add-menubar): one open-menu value, switching in one
// step, open mode ending on every close, controlled proposals and refusals, disabled items
// and bars. The menus are a fake port that records what the bar asks of them.
import { describe, expect, it, vi } from "vitest"
import type { CollectionKey } from "../../collection/key"
import { createListCollection } from "../../collection/list"
import { createService } from "../../machine/service"
import type { MenuCloseReason } from "../menu/menu-tree"
import { type MenubarEvent, type MenubarProps, menubarMachine } from "./menubar.machine"

const key = (k: string) => k as CollectionKey
const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection<string>({
    items: ["file", "edit", "view"],
    getKey: (i) => i,
    getText: (i) => i,
    isDisabled: (i) => disabled.includes(i),
  })

function make(over: Partial<MenubarProps> = {}, disabled: readonly string[] = []) {
  const log: string[] = []
  const focused: string[] = []
  // Idempotent like the adapter's port: an open menu does not reopen.
  const open = new Set<string>()
  const menus = {
    open: (k: CollectionKey, how: { modality: string; edge?: string | undefined }) => {
      if (open.has(k)) return
      open.add(k)
      log.push(`open ${k} ${how.modality}${how.edge ? ` ${how.edge}` : ""}`)
    },
    close: (k: CollectionKey, o: { switching: boolean }) => {
      if (!open.delete(k)) return
      log.push(`close ${k}${o.switching ? " switching" : ""}`)
    },
  }
  let props: MenubarProps = {
    collection: collectionOf(disabled),
    strategy: "roving",
    ids: { list: "root", item: (k: CollectionKey) => k as string },
    loop: true,
    menus,
    ...over,
  }
  const element = (id: string) => ({
    id,
    focus: () => focused.push(id),
  })
  const env = {
    dom: {
      getRootNode: () => document,
      getById: (id: string) => element(id),
      activeElement: () => null,
    },
    clock: { now: () => 0 },
    layout: { pageTarget: () => null },
    locale: { locale: () => "en", dir: () => "ltr" },
    platform: {},
    announcer: { announce: vi.fn(), prepare: () => () => {}, cancel: () => {} },
    modality: {
      modality: () => "keyboard",
      subscribe: () => () => {},
      focusCause: () => "other",
      markFocus: () => {},
      unmarkFocus: () => {},
      recentFocus: () => [],
    },
  }
  const s = createService(menubarMachine, props as never, env as never)
  s.start()
  const send = (e: MenubarEvent) => s.send(e as never)
  return {
    log,
    focused,
    env,
    send,
    state: () => s.view().state as string,
    value: () => (s.view().values as { value: string | null }).value,
    press: (k: string, modality: "pointer" | "keyboard" | "virtual" | "touch" = "pointer") =>
      send({ type: "TRIGGER_PRESS", key: key(k), modality }),
    hover: (k: string) => send({ type: "TRIGGER_HOVER", key: key(k) }),
    closed: (k: string, reason: MenuCloseReason) =>
      send({ type: "MENU_CLOSED", key: key(k), reason }),
    setProps: (next: Partial<MenubarProps>) => {
      props = { ...props, ...next }
      s.setProps(props as never)
    },
  }
}

describe("menubar machine", () => {
  it("opens on a press with its modality and closes on a press of the open item", () => {
    const m = make()
    m.press("file")
    expect(m.state()).toBe("open")
    expect(m.value()).toBe("file")
    m.press("file")
    expect(m.state()).toBe("closed")
    expect(m.value()).toBeNull()
    expect(m.log).toEqual(["open file pointer", "close file"])
  })

  it("opens on the key's edge (Enter on the arrowed-to item: kobaltedev/kobalte#332)", () => {
    const m = make()
    m.send({ type: "NAVIGATE", move: "next" })
    m.send({ type: "TRIGGER_KEY", key: key("edit"), edge: "last" })
    expect(m.value()).toBe("edit")
    expect(m.log).toEqual(["open edit keyboard last"])
  })

  it("hover does nothing with no menu open", () => {
    const m = make()
    m.hover("edit")
    expect(m.state()).toBe("closed")
    expect(m.log).toEqual([])
  })

  it("switches in one step: the old menu closes as a switch, the new one opens", () => {
    const m = make()
    m.press("file")
    m.hover("edit")
    expect(m.value()).toBe("edit")
    m.send({ type: "MENU_NAVIGATE", from: key("edit"), direction: "next" })
    expect(m.value()).toBe("view")
    expect(m.log).toEqual([
      "open file pointer",
      "close file switching",
      "open edit pointer",
      "close edit switching",
      "open view keyboard first",
    ])
  })

  it("the press after a hover switch keeps the menu the hover opened", () => {
    const m = make()
    m.press("file")
    m.hover("edit")
    m.press("edit")
    expect(m.value()).toBe("edit")
    m.press("edit")
    expect(m.value()).toBeNull()
  })

  it("keyboard switching skips a disabled item and wraps with loop", () => {
    const m = make({}, ["edit"])
    m.press("file", "keyboard")
    m.send({ type: "MENU_NAVIGATE", from: key("file"), direction: "next" })
    expect(m.value()).toBe("view")
    m.send({ type: "MENU_NAVIGATE", from: key("view"), direction: "next" })
    expect(m.value()).toBe("file")
  })

  it("loop false stops at the ends", () => {
    const m = make({ loop: false })
    m.press("view", "keyboard")
    m.send({ type: "MENU_NAVIGATE", from: key("view"), direction: "next" })
    expect(m.value()).toBe("view")
  })

  it("hover and press on a disabled item do nothing", () => {
    const m = make({}, ["edit"])
    m.press("file")
    m.hover("edit")
    m.press("edit")
    expect(m.value()).toBe("file")
  })

  it("a disabled menubar opens nothing (mui/base-ui#2727)", () => {
    const m = make({ disabled: true })
    m.press("file")
    m.send({ type: "TRIGGER_KEY", key: key("file"), edge: "first" })
    expect(m.state()).toBe("closed")
    expect(m.log).toEqual([])
  })

  it("vertical: the collapse key closes the menu", () => {
    const m = make({ orientation: "vertical" })
    m.press("file", "keyboard")
    m.send({ type: "MENU_NAVIGATE", from: key("file"), direction: "collapse" })
    expect(m.state()).toBe("closed")
    expect(m.log.at(-1)).toBe("close file")
  })

  it.each([
    "item-select",
    "escape-key",
    "tab-key",
    "outside-press",
    "outside-focus",
    "window-blur",
  ] as const)("open mode ends on a close by %s (kobaltedev/kobalte#333)", (reason) => {
    const onValueChange = vi.fn()
    const m = make({ onValueChange })
    m.press("file")
    m.closed("file", reason)
    expect(m.state()).toBe("closed")
    expect(onValueChange.mock.calls.at(-1)?.[1].reason).toBe(reason)
    m.hover("edit")
    expect(m.state()).toBe("closed")
  })

  it("a close of a menu the bar already switched away from is ignored", () => {
    const m = make()
    m.press("file")
    m.hover("edit")
    m.closed("file", "api")
    expect(m.value()).toBe("edit")
  })

  it("reports each change once with its reason", () => {
    const onValueChange = vi.fn()
    const m = make({ onValueChange })
    m.press("file")
    m.hover("edit")
    m.send({ type: "MENU_NAVIGATE", from: key("edit"), direction: "previous" })
    m.closed("file", "escape-key")
    expect(onValueChange.mock.calls.map((c) => [c[0], c[1].reason])).toEqual([
      ["file", "trigger"],
      ["edit", "hover"],
      ["file", "menu-navigate"],
      [null, "escape-key"],
    ])
  })

  it("controlled: a programmatic value opens its menu, then hover switches (ariakit#7083, #7086)", () => {
    const onValueChange = vi.fn()
    const m = make({ value: null, onValueChange })
    m.setProps({ value: "file" })
    expect(m.state()).toBe("open")
    expect(m.log).toContain("open file keyboard first")
    m.hover("view")
    expect(onValueChange).toHaveBeenLastCalledWith(
      "view",
      expect.objectContaining({ reason: "hover" }),
    )
    // The parent accepts: only View stays open.
    m.setProps({ value: "view" })
    expect(m.log.filter((l) => l.startsWith("open view")).length).toBe(1)
    expect(m.log).toContain("close file switching")
  })

  it("controlled: a refused switch puts the menus back on the parent's value", () => {
    const m = make({ value: "file", onValueChange: () => {} })
    // The adapter syncs the menus to an initial value once they are mounted.
    m.send({ type: "VALUE.SYNC" })
    expect(m.state()).toBe("open")
    m.hover("edit")
    // The parent re-renders with the same value: the proposal is refused.
    m.setProps({ value: "file" })
    expect(m.log.at(-1)).toBe("open file keyboard first")
    expect(m.log).toContain("close edit switching")
  })

  it("focus() focuses the tab stop", () => {
    const m = make()
    m.send({ type: "FOCUS_MENUBAR" })
    expect(m.focused).toEqual(["file"])
  })
})
