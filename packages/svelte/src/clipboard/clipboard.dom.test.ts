// The Clipboard contract model (React's matrix: a fake clipboard that succeeds, rejects or is
// absent) against the Svelte parts, and DOM parity.
import { clipboardContract, clipboardMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import {
  domEnv,
  fakeClipboard,
  recordingAnnouncer,
  testMachine,
  virtualClock,
} from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import Key from "../../fixtures/clipboard/key.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type Mode = "succeed" | "reject" | "absent"
interface Config {
  readonly mode: Mode
  readonly field: boolean
  readonly disabled?: boolean
}
const reactClipboard = (field: boolean, p: Record<string, unknown>) =>
  r(
    R.Clipboard.Root,
    { value: "sk-123", ...p } as never,
    field
      ? [
          r(R.Clipboard.Label, { key: "l" }, "API key"),
          r(
            R.Clipboard.Control,
            { key: "c" },
            r(R.Clipboard.Input),
            r(R.Clipboard.Trigger, null, r(R.Clipboard.Indicator, null, "⧉")),
          ),
        ]
      : r(R.Clipboard.Trigger),
  )

function variant(name: string, cfg: Config) {
  const clock = virtualClock()
  const rec = recordingAnnouncer()
  let results = 0
  let name0: string | null = null
  const skips: Record<string, { readonly skip: string }> = {
    [cfg.mode === "succeed" ? "COPY.FAILED" : "COPY.DONE"]: {
      skip: `this run's clipboard: ${cfg.mode}`,
    },
  }
  if (!cfg.field) skips["INPUT.COPY"] = { skip: "a bare Trigger has no Input" }
  if (cfg.disabled) skips["INPUT.COPY"] = { skip: "a disabled Input takes no focus" }
  const contract = {
    ...clipboardContract,
    events: { ...clipboardContract.events, ...skips },
  } as typeof clipboardContract
  describe(`svelte clipboard model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        rec.log.length = 0
        results = 0
        name0 = null
        return mount(Key, {
          field: cfg.field,
          root: {
            copyFeedbackDuration: 500,
            onCopy: () => results++,
            ...(cfg.disabled ? { disabled: true } : {}),
          },
          provider: {
            announcer: rec.announcer,
            environment: {
              scheduler: clock.scheduler,
              clipboard: fakeClipboard({ mode: cfg.mode, scheduler: clock.scheduler, latency: 10 }),
            },
          },
        } as never)
      },
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms) }),
      anchor: cfg.field ? [{ label: "API key" }] : [],
      props: {
        value: "sk-123",
        messages: clipboardMessages,
        id: "oracle",
        copyFeedbackDuration: 500,
        disabled: cfg.disabled === true,
      },
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      clock,
      a11y,
      invariants: [
        {
          name: "clipboard-trigger-name-stable",
          check: async ({
            env,
          }: {
            env: { part(p: string): { accessibleName(): Promise<string> } }
          }) => {
            const now = await env.part("trigger").accessibleName()
            name0 ??= now
            return now === name0 ? undefined : `the Trigger's name went from "${name0}" to "${now}"`
          },
        },
        {
          name: "clipboard-one-announcement-per-result",
          check: async () =>
            rec.log.length === results
              ? undefined
              : `${rec.log.length} announcements for ${results} results`,
        },
      ],
    } as never)
  })
}
variant("bare trigger, succeed", { mode: "succeed", field: false })
variant("bare trigger, reject", { mode: "reject", field: false })
variant("field, succeed", { mode: "succeed", field: true })
variant("field, reject", { mode: "reject", field: true })
variant("field, absent", { mode: "absent", field: true })
variant("field, disabled", { mode: "succeed", field: true, disabled: true })

describe("Svelte Clipboard matches React", () => {
  it("a bare trigger, a field, disabled", async () => {
    for (const [field, p] of [
      [false, {}],
      [true, {}],
      [true, { disabled: true }],
    ] as const) {
      await clientParity(reactClipboard(field, p), Key, { field, root: p } as never)
    }
  })
})
