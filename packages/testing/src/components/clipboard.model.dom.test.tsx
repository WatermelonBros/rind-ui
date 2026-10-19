// Model-based tests (add-clipboard 5.3): copy through the fake clipboard on a virtual clock (with
// latency, so `copying` is observed), set to succeed, reject and absent; a bare Trigger and a
// field (Label, Control, Input, Trigger, Indicator); disabled. Every modality, the generic
// invariants, axe, and the Clipboard invariants that need the step before (the Trigger's name
// never changes; one announcement per result the page reported).
import { clipboardContract, clipboardMessages } from "@rind-ui/core"
import { Clipboard, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, fakeClipboard, recordingAnnouncer, testMachine, virtualClock } from "../index"

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
  describe(`clipboard model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        rec.log.length = 0
        results = 0
        name0 = null
        return render(
          <RindProvider
            announcer={rec.announcer}
            environment={{
              scheduler: clock.scheduler,
              clipboard: fakeClipboard({ mode: cfg.mode, scheduler: clock.scheduler, latency: 10 }),
            }}
          >
            <Clipboard.Root
              value="sk-123"
              copyFeedbackDuration={500}
              onCopy={() => {
                results++
              }}
              {...(cfg.disabled ? { disabled: true } : {})}
            >
              {cfg.field ? (
                <>
                  <Clipboard.Label>API key</Clipboard.Label>
                  <Clipboard.Control>
                    <Clipboard.Input />
                    <Clipboard.Trigger>
                      <Clipboard.Indicator>⧉</Clipboard.Indicator>
                    </Clipboard.Trigger>
                  </Clipboard.Control>
                </>
              ) : (
                <Clipboard.Trigger />
              )}
            </Clipboard.Root>
          </RindProvider>,
        )
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
