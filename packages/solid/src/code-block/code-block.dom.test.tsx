/** @jsxImportSource solid-js */
// The Code Block contract model (React's: a clipboard that succeeds or rejects) against the
// Solid parts, and markup parity (plain, highlighted, line numbers, collapsed).
import { codeBlockContract, codeBlockMessages, trustedCodeHtml } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, fakeClipboard, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { CodeBlock, type CodeBlockRootProps, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const code = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join("\n")
type P = Record<string, unknown> & { readonly code: string }
const block = (p: P): JSX.Element => (
  <CodeBlock.Root {...(p as CodeBlockRootProps)}>
    <CodeBlock.Header>
      <CodeBlock.Title>lines.txt</CodeBlock.Title>
      <CodeBlock.CopyTrigger />
      <CodeBlock.WrapTrigger />
      <CodeBlock.CollapseTrigger />
    </CodeBlock.Header>
    <CodeBlock.Content />
  </CodeBlock.Root>
)
const reactBlock = (p: P) =>
  r(
    R.CodeBlock.Root,
    p as never,
    r(
      R.CodeBlock.Header,
      null,
      r(R.CodeBlock.Title, null, "lines.txt"),
      r(R.CodeBlock.CopyTrigger),
      r(R.CodeBlock.WrapTrigger),
      r(R.CodeBlock.CollapseTrigger),
    ),
    r(R.CodeBlock.Content),
  )

for (const mode of ["succeed", "reject"] as const) {
  const clock = virtualClock()
  const other = mode === "succeed" ? "COPY.FAILED" : "COPY.DONE"
  const contract = {
    ...codeBlockContract,
    events: { ...codeBlockContract.events, [other]: { skip: `this run's clipboard: ${mode}` } },
  } as typeof codeBlockContract
  describe(`solid code-block model: clipboard ${mode}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider
            environment={{
              scheduler: clock.scheduler,
              clipboard: fakeClipboard({ mode, scheduler: clock.scheduler, latency: 10 }),
            }}
          >
            {block({ code, maxLines: 4, copyFeedbackDuration: 500 })}
          </RindProvider>
        )),
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

describe("Solid Code Block matches React", () => {
  it("plain, a language, line numbers and highlights, collapsed, tokens, trusted HTML", async () => {
    const ts = "const a = 1\n// note\nexport { a }"
    // The token's class is `className` in React and `class` in Solid.
    const pairs: [P, P][] = [
      [{ code: "plain text" }, { code: "plain text" }],
      [
        { code: ts, language: "ts" },
        { code: ts, language: "ts" },
      ],
      [
        { code, lineNumbers: true, highlightLines: "2-3", startLineNumber: 10 },
        { code, lineNumbers: true, highlightLines: "2-3", startLineNumber: 10 },
      ],
      [
        { code, maxLines: 4 },
        { code, maxLines: 4 },
      ],
      [
        {
          code: "a b",
          lines: [[{ text: "a", token: "keyword" }, { text: " " }, { text: "b", className: "x" }]],
        },
        {
          code: "a b",
          lines: [[{ text: "a", token: "keyword" }, { text: " " }, { text: "b", class: "x" }]],
        },
      ],
      [
        { code: "a", html: trustedCodeHtml('<span class="k">a</span>') },
        { code: "a", html: trustedCodeHtml('<span class="k">a</span>') },
      ],
    ]
    for (const [react, solid] of pairs) {
      await clientParity(reactBlock(react), () => block(solid))
    }
  })
})
