// The Alert contract model (React's variants) against the Svelte parts, and DOM parity.
import { alertContract, alertMessages, PENDING_ANNOUNCEMENTS } from "@rind-ui/core"
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
import Fixture from "../../fixtures/alert/alert.svelte"
import Icon from "../../fixtures/alert/icon.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

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
type Props = Record<string, unknown>
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
  describe(`svelte alert model: uncontrolled, announce ${announce}`, () => {
    testMachine(alertContract, {
      test: it,
      setup: () => mount(Fixture, { announce }),
      target: () => screen,
      anchor,
      props: { ...base, announce } as never,
      invariants: [announcementCount()],
      a11y,
      modalities: ["pointer", "keyboard", "virtual"],
    })
  })
  describe(`svelte alert model: controlled ($sync:open), announce ${announce}`, () => {
    testMachine(alertContract, {
      test: it,
      setup: () => mount(Fixture, { announce, open: true, controlled: true }),
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

describe("Svelte Alert matches React", () => {
  it("open, closed, assertive, icon", async () => {
    for (const p of [{}, { defaultOpen: false }, { announce: "assertive" }]) {
      await clientParity(reactUi(p), Fixture, p as never)
    }
    await clientParity(
      r(R.Alert.Root, null, r(R.Alert.Icon, { label: "Error" }), r(R.Alert.Title, null, "T")),
      Icon,
      {},
    )
  })
})
