// The Dialog contract models (React's: modal, closeOnEscape false, closeOnInteractOutside
// false, non-modal, and the alertdialog role) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { alertDialogRoleContract, dialogContract, nonModalDialogContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Dialog } from "./dialog"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface P {
  readonly role?: "dialog" | "alertdialog"
  readonly defaultOpen?: boolean
  readonly modal?: boolean
  readonly closeOnEscape?: boolean
  readonly closeOnInteractOutside?: boolean
  readonly keepMounted?: boolean
}
/** The configuration the next fixture renders. */
let current: { p: P; portal: boolean } = { p: {}, portal: true }

// As a theme lays them out: a full-screen backdrop, the content centred.
const BACKDROP = { position: "fixed", inset: 0 }
const POSITIONER = { position: "fixed", inset: 0, display: "grid", placeItems: "center" }
const BACKDROP_CSS = "position: fixed; inset: 0px"
const POSITIONER_CSS = "position: fixed; inset: 0px; display: grid; place-items: center"

const PARTS = `<div rindDialogBackdrop style="${BACKDROP_CSS}"></div>
        <div rindDialogPositioner style="${POSITIONER_CSS}">
          <div rindDialogContent>
            @if (alert) {
              <h2 rindDialogTitle>{{ title }}</h2>
              <p rindDialogDescription>This cannot be undone.</p>
              <button rindDialogCancel>Cancel</button>
              <button rindDialogAction>Delete</button>
            } @else {
              <h2 rindDialogTitle>{{ title }}</h2>
              <p rindDialogDescription>Change your display name.</p>
              <label>Name <input /></label>
              <button rindDialogCloseTrigger>Close</button>
              <button rindDialogCancel>Cancel</button>
              <button rindDialogAction>Save</button>
            }
          </div>
        </div>`

@Component({
  selector: "rind-f",
  imports: [Dialog],
  template: `<div id="app">
    <ng-container
      rindDialogRoot
      [role]="p.role ?? 'dialog'"
      [defaultOpen]="p.defaultOpen"
      [modal]="p.modal"
      [closeOnEscape]="p.closeOnEscape"
      [closeOnInteractOutside]="p.closeOnInteractOutside"
      [keepMounted]="p.keepMounted ?? false"
    >
      <button rindDialogTrigger>{{ title }}</button>
      @if (portal) {
        <ng-template rindDialogPortal>${PARTS}</ng-template>
      } @else {
        ${PARTS}
      }
    </ng-container>
  </div>`,
})
class Tree {
  readonly p = current.p
  readonly portal = current.portal
  readonly alert = current.p.role === "alertdialog"
  readonly title = this.alert ? "Delete project?" : "Edit profile"
}

const reactTree = (p: P, portal = true) => {
  const alert = p.role === "alertdialog"
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
  describe(`angular dialog model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        current = { p: props, portal: true }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [
        { name: props.role === "alertdialog" ? "Delete project?" : "Edit profile" },
      ] as never,
      // `root` is internal (set by the Root); the oracle only needs a value.
      props: { ...base, ...props } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}

describe("Angular Dialog matches React", () => {
  for (const p of [
    {},
    { defaultOpen: true },
    { defaultOpen: true, modal: false },
    { defaultOpen: true, role: "alertdialog" },
    { keepMounted: true },
  ] as P[]) {
    for (const portal of [true, false]) {
      // In place: the content is inside the compared container.
      it(`${JSON.stringify(p)}, ${portal ? "portalled" : "in place"}`, async () => {
        current = { p, portal }
        await both(reactTree(p, portal), Tree)
      })
    }
  }
})
