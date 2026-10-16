import { describe, expect, it, vi } from "vitest"
import { dialogConnect } from "./dialog.connect"
import { dialogContract } from "./dialog.contract"
import { dialogMachine } from "./dialog.machine"
import { dialogMessages } from "./dialog.messages"
import { dialogMeta } from "./dialog.meta"

describe("dialog meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(dialogContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(dialogMeta.contract.actions).toEqual(actions)
    expect(dialogMeta.contract.queries).toEqual(Object.keys(dialogContract.queries))
    expect(dialogMeta.contract.traits).toEqual(dialogContract.traits)
    expect(Object.keys(dialogMeta.states).sort()).toEqual(
      Object.keys(dialogMachine.def.states).sort(),
    )
  })

  it("data attributes", () => {
    const meta = { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 }
    const a = dialogConnect(
      {
        scope: "dialog",
        instance: "r",
        open: false,
        modal: true,
        opener: "t",
        closeReason: "escape-key",
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
      "close-trigger": a.closeTrigger({ ...btn, empty: false }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        dialogMeta.dataAttributes[part as keyof typeof dialogMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
