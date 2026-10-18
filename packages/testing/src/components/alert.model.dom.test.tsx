// Model-based tests (add-alert 5.1): dismiss in pointer, keyboard and virtual, and `$sync:open`
// both ways, for announce off / polite / assertive. A dismissed alert unmounts (`absentIn:
// ["closed"]`). After every step: the announcement log grew by exactly what the oracle expects
// (one per appearance, none on dismissal), plus the generic invariants (focus never on body
// after a dismissal from inside; rule 23, no live region of its own). A `role="alert"`
// wrapper fails rule 23.
import { alertContract, alertMessages, PENDING_ANNOUNCEMENTS } from "@rind-ui/core"
import { Alert, type AlertRootProps } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import axe from "axe-core"
import { beforeEach, describe, expect, it } from "vitest"
import {
  allowRindWarning,
  type ConsumerInvariant,
  domEnv,
  installAnnouncementLog,
  testMachine,
} from "../index"

// The broken role=alert wrapper below logs it on purpose.
beforeEach(() => allowRindWarning(/alert: an alert is never a live region of its own/))

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

// Every prop the machine reads, as the component receives it.
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

const ui = (props: AlertRootProps) => (
  <div>
    <Alert.Root {...props}>
      <Alert.Title>Couldn't save</Alert.Title>
      <Alert.Description>Disk full</Alert.Description>
      <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
    </Alert.Root>
    <button type="button">Retry</button>
  </div>
)

/** One announcement per appearance (mount, or closed → open) with a live `announce`, else none. */
function announcementCount(): ConsumerInvariant<typeof alertContract> {
  let seen = 0
  let last: string | undefined
  let container: Element | null = null
  return {
    name: "alert-announces-on-appearance",
    check: async ({ state, props }) => {
      // Keyed messages are spoken after their debounce: wait until none is pending.
      await waitFor(() => expect(Reflect.get(globalThis, PENDING_ANNOUNCEMENTS) ?? 0).toBe(0))
      const now = installAnnouncementLog().length
      // A new test renders a new container (and the log was reset).
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
  describe(`alert model: uncontrolled, announce ${announce}`, () => {
    testMachine(alertContract, {
      test: it,
      setup: () => render(ui({ announce })),
      target: () => screen,
      anchor,
      props: { ...base, announce } as never,
      invariants: [announcementCount()],
      a11y,
      modalities: ["pointer", "keyboard", "virtual"],
    })
  })

  describe(`alert model: controlled ($sync:open), announce ${announce}`, () => {
    testMachine(alertContract, {
      test: it,
      setup: () => render(ui({ announce, open: true })),
      rerender: (next, rendered) =>
        rendered.rerender(ui({ announce, open: (next as { open: boolean }).open })),
      target: () => screen,
      anchor,
      props: { ...base, announce, open: true } as never,
      invariants: [announcementCount()],
      a11y,
      modalities: ["pointer"],
    })
  })
}

describe("alert model: a role=alert wrapper", () => {
  it("fails rule 23 (no live region of its own)", { timeout: 60_000 }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(alertContract, {
      test: (name, fn) => tests.push({ name, fn }),
      setup: () => render(ui({ role: "alert", announce: "off" })),
      target: () => domEnv({ timeout: 200 }),
      anchor,
      props: { ...base, announce: "off" } as never,
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.join("\n")).toMatch(/live region; announce through the Announcer/)
  })
})
