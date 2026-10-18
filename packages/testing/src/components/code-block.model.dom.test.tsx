// Model-based tests (add-code-block 6.1): copy (success, then failure, through the fake
// clipboard on a virtual clock), wrap and expand, in pointer, keyboard, touch and virtual, with
// the generic invariants, axe and the copy announcements after every step.
import { codeBlockContract, codeBlockMessages } from "@rind-ui/core"
import { CodeBlock, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { domEnv, fakeClipboard, testMachine, virtualClock } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const code = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join("\n")

function variant(mode: "succeed" | "reject") {
  // The delays and the clipboard's latency run on a virtual clock: no real time passes.
  const clock = virtualClock()
  const other = mode === "succeed" ? "COPY.FAILED" : "COPY.DONE"
  const contract = {
    ...codeBlockContract,
    events: { ...codeBlockContract.events, [other]: { skip: `this run's clipboard: ${mode}` } },
  } as typeof codeBlockContract
  describe(`code-block model: clipboard ${mode}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        render(
          <RindProvider
            environment={{
              scheduler: clock.scheduler,
              clipboard: fakeClipboard({ mode, scheduler: clock.scheduler, latency: 10 }),
            }}
          >
            <CodeBlock.Root code={code} maxLines={4} copyFeedbackDuration={500}>
              <CodeBlock.Header>
                <CodeBlock.Title>lines.txt</CodeBlock.Title>
                <CodeBlock.CopyTrigger />
                <CodeBlock.WrapTrigger />
                <CodeBlock.CollapseTrigger />
              </CodeBlock.Header>
              <CodeBlock.Content />
            </CodeBlock.Root>
          </RindProvider>,
        ),
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms) }),
      anchor: [{ title: "lines.txt" }],
      props: {
        code,
        messages: codeBlockMessages,
        id: "oracle",
        copyFeedbackDuration: 500,
        collapsible: true,
        defaultExpanded: false,
      },
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      clock,
      a11y,
    })
  })
}

variant("succeed")
variant("reject")
