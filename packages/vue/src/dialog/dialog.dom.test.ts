// The Dialog contract models (React's: modal, closeOnEscape false, closeOnInteractOutside
// false, non-modal, and the alertdialog role) against the Vue parts, and markup parity.
import { alertDialogRoleContract, dialogContract, nonModalDialogContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Dialog } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown>
// As a theme lays them out: a full-screen backdrop, the content centred.
const BACKDROP = { position: "fixed", inset: 0 }
const POSITIONER = { position: "fixed", inset: 0, display: "grid", placeItems: "center" }

const tree = (p: P, portal = true) => {
  const alert = p["role"] === "alertdialog"
  const title = alert ? "Delete project?" : "Edit profile"
  const parts = () => [
    h(Dialog.Backdrop, { style: BACKDROP }),
    h(Dialog.Positioner, { style: POSITIONER }, () =>
      h(Dialog.Content, null, () =>
        alert
          ? [
              h(Dialog.Title, null, () => title),
              h(Dialog.Description, null, () => "This cannot be undone."),
              h(Dialog.Cancel, null, () => "Cancel"),
              h(Dialog.Action, null, () => "Delete"),
            ]
          : [
              h(Dialog.Title, null, () => title),
              h(Dialog.Description, null, () => "Change your display name."),
              h("label", null, ["Name ", h("input")]),
              h(Dialog.CloseTrigger, null, () => "Close"),
              h(Dialog.Cancel, null, () => "Cancel"),
              h(Dialog.Action, null, () => "Save"),
            ],
      ),
    ),
  ]
  return h("div", { id: "app" }, [
    h(Dialog.Root, p, () => [
      h(Dialog.Trigger, null, () => title),
      portal ? h(Dialog.Portal, null, parts) : parts(),
    ]),
  ])
}
const reactTree = (p: P, portal = true) => {
  const alert = p["role"] === "alertdialog"
  const title = alert ? "Delete project?" : "Edit profile"
  const parts = [
    r(R.Dialog.Backdrop, { key: "b", style: BACKDROP as never }),
    r(
      R.Dialog.Positioner,
      { key: "p", style: POSITIONER as never },
      r(
        R.Dialog.Content,
        null,
        ...(alert
          ? [
              r(R.Dialog.Title, { key: 1 }, title),
              r(R.Dialog.Description, { key: 2 }, "This cannot be undone."),
              r(R.Dialog.Cancel, { key: 3 }, "Cancel"),
              r(R.Dialog.Action, { key: 4 }, "Delete"),
            ]
          : [
              r(R.Dialog.Title, { key: 1 }, title),
              r(R.Dialog.Description, { key: 2 }, "Change your display name."),
              r("label", { key: 3 }, "Name ", r("input")),
              r(R.Dialog.CloseTrigger, { key: 4 }, "Close"),
              r(R.Dialog.Cancel, { key: 5 }, "Cancel"),
              r(R.Dialog.Action, { key: 6 }, "Save"),
            ]),
      ),
    ),
  ]
  return r(
    "div",
    { id: "app" },
    r(
      R.Dialog.Root,
      p as never,
      r(R.Dialog.Trigger, null, title),
      portal ? r(R.Dialog.Portal, null, parts) : parts,
    ),
  )
}

const base = {
  open: undefined,
  root: "oracle",
  role: undefined,
  modal: undefined,
  closeOnEscape: undefined,
  closeOnInteractOutside: undefined,
}
const sets: { name: string; contract: typeof dialogContract; props: P }[] = [
  { name: "modal", contract: dialogContract, props: {} },
  { name: "closeOnEscape false", contract: dialogContract, props: { closeOnEscape: false } },
  {
    name: "closeOnInteractOutside false",
    contract: dialogContract,
    props: { closeOnInteractOutside: false },
  },
  { name: "non-modal", contract: nonModalDialogContract, props: { modal: false } },
  {
    name: "alertdialog",
    contract: alertDialogRoleContract as unknown as typeof dialogContract,
    props: { role: "alertdialog" },
  },
  {
    name: "alertdialog, closeOnEscape false",
    contract: alertDialogRoleContract as unknown as typeof dialogContract,
    props: { role: "alertdialog", closeOnEscape: false },
  },
]
for (const { name, contract, props } of sets) {
  describe(`vue dialog model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => mount(() => tree(props)),
      target: () => screen,
      anchor: [
        { name: props["role"] === "alertdialog" ? "Delete project?" : "Edit profile" },
      ] as never,
      // `root` is internal (set by Dialog.Root); the oracle only needs a value.
      props: { ...base, ...props } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}

describe("Vue Dialog matches React", () => {
  it("closed, open, non-modal, alertdialog, keep mounted", async () => {
    for (const p of [
      {},
      { defaultOpen: true },
      { defaultOpen: true, modal: false },
      { defaultOpen: true, role: "alertdialog" },
      { keepMounted: true },
    ] as P[]) {
      await serverParity(reactTree(p), () => tree(p))
      await clientParity(reactTree(p), () => tree(p))
      // In place: the content is inside the compared container.
      await serverParity(reactTree(p, false), () => tree(p, false))
      await clientParity(reactTree(p, false), () => tree(p, false))
    }
  })
})
