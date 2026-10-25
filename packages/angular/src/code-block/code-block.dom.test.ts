// The Code Block contract model (React's: a clipboard that succeeds or rejects) against the
// Angular parts, and markup parity (plain, highlighted, line numbers, collapsed).
import { Component } from "@angular/core"
import { codeBlockContract, codeBlockMessages, trustedCodeHtml } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, fakeClipboard, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { CodeBlock } from "./code-block"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const code = Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join("\n")
type P = Record<string, unknown> & { readonly code: string }
/** The configuration and environment the next fixture renders. */
let current: { p: P; environment?: unknown } = { p: { code } }

const BLOCK = `<div
      rindCodeBlockRoot
      [code]="p.code"
      [language]="$any(p['language'])"
      [lines]="$any(p['lines'])"
      [html]="$any(p['html'])"
      [lineNumbers]="$any(p['lineNumbers']) ?? false"
      [highlightLines]="$any(p['highlightLines'])"
      [startLineNumber]="$any(p['startLineNumber']) ?? 1"
      [maxLines]="$any(p['maxLines'])"
      [copyFeedbackDuration]="$any(p['copyFeedbackDuration'])"
    >
      <div rindCodeBlockHeader>
        <span rindCodeBlockTitle>lines.txt</span>
        <button rindCodeBlockCopyTrigger></button>
        <button rindCodeBlockWrapTrigger></button>
        <button rindCodeBlockCollapseTrigger></button>
      </div>
      <pre rindCodeBlockContent></pre>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, CodeBlock],
  template: `@if (environment) {
      <ng-container rindProvider [environment]="$any(environment)">${BLOCK}</ng-container>
    } @else {
      ${BLOCK}
    }`,
})
class Tree {
  readonly p = current.p
  readonly environment = current.environment
}
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
  describe(`angular code-block model: clipboard ${mode}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        current = {
          p: { code, maxLines: 4, copyFeedbackDuration: 500 },
          environment: {
            scheduler: clock.scheduler,
            clipboard: fakeClipboard({ mode, scheduler: clock.scheduler, latency: 10 }),
          },
        }
        return mount(Tree)
      },
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

describe("Angular Code Block matches React", () => {
  it("plain, a language, line numbers and highlights, collapsed, tokens, trusted HTML", async () => {
    const ts = "const a = 1\n// note\nexport { a }"
    for (const p of [
      { code: "plain text" },
      { code: ts, language: "ts" },
      { code, lineNumbers: true, highlightLines: "2-3", startLineNumber: 10 },
      { code, maxLines: 4 },
      {
        code: "a b",
        lines: [[{ text: "a", token: "keyword" }, { text: " " }, { text: "b", className: "x" }]],
      },
      { code: "a", html: trustedCodeHtml('<span class="k">a</span>') },
    ] as P[]) {
      current = { p }
      await both(reactBlock(p), Tree)
    }
  })
})
