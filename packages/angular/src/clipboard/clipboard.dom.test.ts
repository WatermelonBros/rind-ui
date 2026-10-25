// The Clipboard contract model (React's matrix: a fake clipboard that succeeds, rejects or is
// absent) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
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
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Clipboard } from "./clipboard"

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
/** The fixture's configuration and environment, for the next mount. */
let current: {
  field: boolean
  disabled: boolean
  feedback?: number
  provider?: { announcer: unknown; environment: unknown }
  copied: () => void
} = { field: false, disabled: false, copied: () => {} }

const CLIPBOARD = `<div
      rindClipboardRoot
      value="sk-123"
      [disabled]="cfg.disabled"
      [copyFeedbackDuration]="cfg.feedback"
      (copyResult)="cfg.copied()"
    >
      @if (cfg.field) {
        <label rindClipboardLabel>API key</label>
        <div rindClipboardControl>
          <input rindClipboardInput />
          <button rindClipboardTrigger><span rindClipboardIndicator>⧉</span></button>
        </div>
      } @else {
        <button rindClipboardTrigger></button>
      }
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Clipboard],
  template: `@if (cfg.provider; as p) {
      <ng-container rindProvider [announcer]="$any(p.announcer)" [environment]="$any(p.environment)">
        ${CLIPBOARD}
      </ng-container>
    } @else {
      ${CLIPBOARD}
    }`,
})
class Tree {
  readonly cfg = current
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
  describe(`angular clipboard model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        rec.log.length = 0
        results = 0
        name0 = null
        current = {
          field: cfg.field,
          disabled: cfg.disabled === true,
          feedback: 500,
          provider: {
            announcer: rec.announcer,
            environment: {
              scheduler: clock.scheduler,
              clipboard: fakeClipboard({ mode: cfg.mode, scheduler: clock.scheduler, latency: 10 }),
            },
          },
          copied: () => results++,
        }
        return mount(Tree)
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

describe("Angular Clipboard matches React", () => {
  it("a bare trigger, a field, disabled", async () => {
    for (const [field, p] of [
      [false, {}],
      [true, {}],
      [true, { disabled: true }],
    ] as const) {
      current = { field, disabled: "disabled" in p, copied: () => {} }
      await both(reactClipboard(field, p), Tree)
    }
  })
})
