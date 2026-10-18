// The Dialog meta covers role="alertdialog" (merge-alert-dialog-into-dialog; formerly the
// Alert Dialog meta tests): the confirmation's contract, its fixed props and its parts.
import { describe, expect, it, vi } from "vitest"
import { dialogConnect } from "./dialog.connect"
import { alertDialogRoleContract } from "./dialog.contract"
import { dialogMachine } from "./dialog.machine"
import { dialogMessages } from "./dialog.messages"
import { dialogMeta } from "./dialog.meta"

describe("dialog meta matches a confirmation's code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(alertDialogRoleContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(dialogMeta.contract.actions).toEqual(actions)
    expect(dialogMeta.contract.queries).toEqual(Object.keys(alertDialogRoleContract.queries))
    expect(dialogMeta.contract.traits).toEqual(alertDialogRoleContract.traits)
    expect(Object.keys(dialogMeta.states).sort()).toEqual(
      Object.keys(dialogMachine.def.states).sort(),
    )
  })

  it("documents the role and the confirmation's buttons", () => {
    expect(dialogMeta.props.role.type).toBe('"dialog" | "alertdialog"')
    expect(dialogMeta.contract.actions).toHaveProperty("cancel")
    expect(dialogMeta.contract.actions).toHaveProperty("confirm")
    expect(dialogMeta.parts.map((p) => p.part)).toEqual(
      expect.arrayContaining(["cancel", "action"]),
    )
  })

  it("data attributes", () => {
    const meta = { index: 1, depth: 1, nested: true, hasNested: true, nestedCount: 1 }
    const a = dialogConnect(
      {
        scope: "dialog",
        role: "alertdialog",
        modal: true,
        instance: "r",
        open: false,
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
      cancel: a.cancel(btn),
      action: a.action(btn),
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
