import { describe, expect, it, vi } from "vitest"
import { dialogMessages } from "../dialog/dialog.messages"
import { alertDialogConnect } from "./alert-dialog.connect"
import { alertDialogContract } from "./alert-dialog.contract"
import { alertDialogMachine } from "./alert-dialog.machine"
import { alertDialogMeta } from "./alert-dialog.meta"

describe("alert dialog meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(alertDialogContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(alertDialogMeta.contract.actions).toEqual(actions)
    expect(alertDialogMeta.contract.queries).toEqual(Object.keys(alertDialogContract.queries))
    expect(alertDialogMeta.contract.traits).toEqual(alertDialogContract.traits)
    expect(Object.keys(alertDialogMeta.states).sort()).toEqual(
      Object.keys(alertDialogMachine.def.states).sort(),
    )
  })

  it("has no close action and no modal or outside-close prop", () => {
    expect(alertDialogMeta.contract.actions).not.toHaveProperty("close")
    expect(alertDialogMeta.props).not.toHaveProperty("modal")
    expect(alertDialogMeta.props).not.toHaveProperty("closeOnInteractOutside")
  })

  it("data attributes", () => {
    const meta = { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 }
    const a = alertDialogConnect(
      {
        instance: "r",
        open: false,
        opener: "t",
        closeReason: "ESCAPE_KEY",
        rendered: { title: "ti", description: "de" },
        contentMounted: true,
        meta,
        titleFocusTarget: false,
        focusWithin: true,
        contentFocused: true,
        modality: "keyboard",
        messages: dialogMessages,
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
      cancel: a.cancel(btn),
      action: a.action(btn),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        alertDialogMeta.dataAttributes[part as keyof typeof alertDialogMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
