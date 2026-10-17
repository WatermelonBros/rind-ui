import { describe, expect, it } from "vitest"
import { toasterConnect } from "./toast.connect"
import { toastContract, toasterContract } from "./toast.contract"
import { toastMachine } from "./toast.machine"
import { toastMessages } from "./toast.messages"
import { toastMeta } from "./toast.meta"
import type { ToastData, ToastId, ToastInstance } from "./toast.types"
import type { ToastSnapshot } from "./toaster"

const modalities = (c: { actions: Record<string, object> }) =>
  Object.entries(c.actions).map(([name, a]) => [
    name,
    [
      ...(["pointer", "touch", "keyboard"] as const).filter((m) => m in a),
      ...("pointer" in a ? ["virtual"] : []),
    ],
  ])

describe("toast meta matches the code", () => {
  it("contracts and states", () => {
    expect(toastMeta.contract.actions).toEqual(
      Object.fromEntries([...modalities(toasterContract), ...modalities(toastContract)]),
    )
    expect(toastMeta.contract.queries).toEqual([
      ...Object.keys(toasterContract.queries),
      ...Object.keys(toastContract.queries).filter((q) => !(q in toasterContract.queries)),
    ])
    expect(toastMeta.contract.traits).toEqual(toasterContract.traits)
    expect(toastMeta.contract.traits).toEqual(toastContract.traits)
    expect(Object.keys(toastMeta.states).sort()).toEqual(
      Object.keys(toastMachine.def.states).sort(),
    )
  })

  it("data attributes", () => {
    const toast: ToastSnapshot = {
      instance: "t1" as ToastInstance,
      data: { id: "a" as ToastId, type: "info" } as ToastData,
      state: "dismissed",
      dismissReason: "swipe",
      reasons: new Set(["hover"]),
      limited: true,
      swiping: true,
      swipeDirection: "right",
      height: 40,
    }
    const a = toasterConnect({
      instance: "r",
      placement: "bottom-end",
      toasts: [toast],
      expanded: true,
      paused: true,
      gap: 14,
      hotkey: "F6",
      messages: toastMessages,
    })
    const btn = { focused: true, modality: "keyboard" as const, pressed: true }
    const closing = { ...toast, data: { ...toast.data, dismissible: false } }
    const parts = {
      region: a.region(),
      list: a.list(),
      root: a.root(toast, { rendered: { title: true, description: true } }),
      title: a.title(toast),
      description: a.description(toast),
      "action-trigger": a.actionTrigger(toast, btn),
      "close-trigger": a.closeTrigger(closing, { ...btn, empty: false }),
    }
    for (const [part, props] of Object.entries(parts)) {
      const keys = Object.keys(props).filter((k) => k.startsWith("data-"))
      const documented = Object.keys(
        toastMeta.dataAttributes[part as keyof typeof toastMeta.dataAttributes],
      )
      expect(documented.sort(), part).toEqual(keys.sort())
    }
  })
})
