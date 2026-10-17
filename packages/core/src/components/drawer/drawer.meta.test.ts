import { describe, expect, it, vi } from "vitest"
import { drawerConnect, drawerIndentProps } from "./drawer.connect"
import { drawerContract } from "./drawer.contract"
import { drawerMachine } from "./drawer.machine"
import { drawerMessages } from "./drawer.messages"
import { drawerMeta } from "./drawer.meta"

describe("drawer meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(drawerContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(drawerMeta.contract.actions).toEqual(actions)
    expect(drawerMeta.contract.queries).toEqual(Object.keys(drawerContract.queries))
    expect(drawerMeta.contract.traits).toEqual(drawerContract.traits)
    expect(Object.keys(drawerMeta.states).sort()).toEqual(
      Object.keys(drawerMachine.def.states).sort(),
    )
  })

  it("data attributes", () => {
    const meta = { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 }
    const resolved = [
      { point: 0.5, size: 200, offset: 200 },
      { point: 1, size: 400, offset: 0 },
    ]
    const a = drawerConnect(
      {
        instance: "r",
        open: false,
        modal: true,
        opener: "t",
        closeReason: "swipe",
        rendered: { title: "ti", description: "de" },
        contentMounted: true,
        meta,
        titleFocusTarget: false,
        focusWithin: true,
        contentFocused: true,
        modality: "keyboard",
        side: "bottom",
        swipe: "swiping",
        nested: { count: 1, frontmostSize: 100, swiping: true },
        size: 400,
        resolved,
        snapPoint: 0.5,
        messages: drawerMessages,
      },
      vi.fn(),
    )
    const btn = {
      id: "t",
      focused: true,
      modality: "keyboard" as const,
      pressed: true,
      disabled: true,
    }
    const parts = {
      trigger: { ...a.trigger(btn), "data-state": "x" },
      backdrop: a.backdrop(),
      positioner: a.positioner(),
      content: a.content({}),
      title: a.title({ level: 2, tag: "h2" }),
      description: a.description(),
      "close-trigger": a.closeTrigger({ ...btn, empty: false }),
      handle: a.handle({ focused: true, modality: "keyboard", pressed: true }),
      indent: drawerIndentProps("indent", true),
      "indent-background": drawerIndentProps("indent-background", true),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        drawerMeta.dataAttributes[part as keyof typeof drawerMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
