// The Alert contract model (React's variants) against the Angular parts, hydration silence,
// and markup parity with @rind-ui/react.
import { Component, input } from "@angular/core"
import {
  type AlertAnnounce,
  alertContract,
  alertMessages,
  PENDING_ANNOUNCEMENTS,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import {
  allowRindWarning,
  type ConsumerInvariant,
  installAnnouncementLog,
  testMachine,
} from "@rind-ui/testing"
import { screen, waitFor } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Alert } from "./alert"

beforeEach(() => allowRindWarning(/alert: an alert is never a live region of its own/))

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const base = {
  open: undefined,
  defaultOpen: undefined,
  onOpenChange: undefined,
  announce: undefined,
  announcement: undefined,
  messages: alertMessages,
  id: "oracle",
  lang: undefined,
  moveFocusOut: undefined,
}
const anchor = [{ title: "Couldn't save" }] as never
type Props = { announce?: AlertAnnounce; open?: boolean; defaultOpen?: boolean }

/** The inputs the next fixture starts with (a server render cannot set inputs). */
let current: Props = {}

@Component({
  selector: "rind-f",
  imports: [Alert],
  template: `<div>
      <div rindAlertRoot [announce]="announce()" [open]="open()" [defaultOpen]="defaultOpen()">
        <div rindAlertTitle>Couldn't save</div>
        <div rindAlertDescription>Disk full</div>
        <button rindAlertCloseTrigger>Dismiss</button>
      </div>
      <button type="button">Retry</button>
    </div>`,
})
class Ui {
  readonly announce = input<AlertAnnounce | undefined>(current.announce)
  readonly open = input<boolean | undefined>(current.open)
  readonly defaultOpen = input<boolean | undefined>(current.defaultOpen)
}
const reactUi = (props: Props) =>
  r(
    "div",
    null,
    r(
      R.Alert.Root,
      props,
      r(R.Alert.Title, null, "Couldn't save"),
      r(R.Alert.Description, null, "Disk full"),
      r(R.Alert.CloseTrigger, null, "Dismiss"),
    ),
    r("button", { type: "button" }, "Retry"),
  )

function announcementCount(): ConsumerInvariant<typeof alertContract> {
  let seen = 0
  let last: string | undefined
  let container: Element | null = null
  return {
    name: "alert-announces-on-appearance",
    check: async ({ state, props }) => {
      await waitFor(() => expect(Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) ?? 0).toBe(0))
      const now = installAnnouncementLog().length
      if (document.body.firstElementChild !== container) {
        container = document.body.firstElementChild
        seen = 0
        last = undefined
      }
      const live = (props["announce"] ?? "polite") !== "off"
      const expected = live && state === "open" && last !== "open" ? 1 : 0
      const grew = now - seen
      seen = now
      last = state
      return grew === expected ? undefined : `announced ${grew} times, expected ${expected}`
    },
  }
}

for (const announce of ["off", "polite", "assertive"] as const) {
  describe(`angular alert model: uncontrolled, announce ${announce}`, () => {
    testMachine(alertContract, {
      test: it,
      setup: () => {
        current = { announce }
        return mount(Ui)
      },
      target: () => screen,
      anchor,
      props: { ...base, announce } as never,
      invariants: [announcementCount()],
      a11y,
      modalities: ["pointer", "keyboard", "virtual"],
    })
  })
  describe(`angular alert model: controlled ([open]), announce ${announce}`, () => {
    testMachine(alertContract, {
      test: it,
      setup: () => {
        current = { announce, open: true }
        return mount(Ui)
      },
      rerender: (next, rendered) => rendered.rerender({ open: (next as { open: boolean }).open }),
      target: () => screen,
      anchor,
      props: { ...base, announce, open: true } as never,
      invariants: [announcementCount()],
      a11y,
      modalities: ["pointer"],
    })
  })
}

@Component({
  selector: "rind-f",
  imports: [Alert],
  template: `<div rindAlertRoot><span rindAlertIcon label="Error"></span><div rindAlertTitle>T</div></div>`,
})
class WithIcon {}

describe("angular alert", () => {
  it("matches React: open, closed, icon", async () => {
    for (const p of [{}, { defaultOpen: false }, { announce: "assertive" }] as const) {
      current = p
      await both(reactUi(p), Ui)
    }
    await both(
      r(R.Alert.Root, null, r(R.Alert.Icon, { label: "Error" }), r(R.Alert.Title, null, "T")),
      WithIcon,
    )
  })

  it("closed: the root keeps its element, hidden under an author display rule, no part inside", async () => {
    current = { defaultOpen: false }
    const style = document.head.appendChild(document.createElement("style"))
    style.textContent = `[data-scope="alert"] { display: block; }`
    try {
      const { host } = await mount(Ui)
      const root = host.querySelector<HTMLElement>('[data-scope="alert"]')
      expect(root?.hidden).toBe(true)
      expect(root && getComputedStyle(root).display).toBe("none")
      expect(host.querySelector('[data-scope="alert"][data-part]')).toBeNull()
      expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull()
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy()
    } finally {
      style.remove()
    }
  })
})
