// Model-based tests: the Collapsible contract in every modality (pointer, keyboard, virtual),
// both `disabled` configurations and the three `closedContent` modes (task 6.1), plus a
// consumer wrapper that breaks a per-contract invariant (spec "Contract").
import { type ClosedContent, collapsibleContract, platforms } from "@rind-ui/core"
import { Collapsible, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ComponentProps } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type RootProps = ComponentProps<typeof Collapsible.Root>
// Every prop the machine reads, as the component receives it.
const base = {
  open: undefined,
  defaultOpen: undefined,
  onOpenChange: undefined,
  disabled: undefined,
  focusOutOfContent: undefined,
}
const anchor = [{ name: "Details" }] as never

const ui = (props: RootProps) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    <Collapsible.Root {...props}>
      <Collapsible.Trigger>
        Details <Collapsible.Indicator />
      </Collapsible.Trigger>
      <Collapsible.Content>
        <a href="#more">More</a>
      </Collapsible.Content>
    </Collapsible.Root>
  </RindProvider>
)

const modes: readonly ClosedContent[] = ["until-found", "hidden", "unmount"]
for (const closedContent of modes) {
  for (const disabled of [false, true]) {
    for (const defaultOpen of [false, true]) {
      const props = { closedContent, disabled, defaultOpen }
      describe(`collapsible model: ${closedContent}, disabled ${disabled}, open ${defaultOpen}`, () => {
        testMachine(collapsibleContract, {
          test: it,
          setup: () => render(ui(props)),
          target: () => screen,
          anchor,
          props: { ...base, disabled, defaultOpen } as never,
          a11y,
        })
      })
    }
  }
}

describe("collapsible model: controlled ($sync:open)", () => {
  testMachine(collapsibleContract, {
    test: it,
    setup: () => render(ui({ open: false })),
    rerender: (next, rendered) => rendered.rerender(ui({ open: (next as { open: boolean }).open })),
    target: () => screen,
    anchor,
    props: { ...base, open: false } as never,
    a11y,
    modalities: ["pointer"],
  })
})

describe("collapsible model: a wrapper that hides the content from AT", () => {
  it("fails the per-contract invariant naming the content part", async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(collapsibleContract, {
      test: (name, fn) => tests.push({ name, fn }),
      setup: () =>
        render(
          <Collapsible.Root>
            <Collapsible.Trigger>Details</Collapsible.Trigger>
            <Collapsible.Content aria-hidden="true">Body</Collapsible.Content>
          </Collapsible.Root>,
        ),
      target: () => domEnv({ timeout: 200 }),
      anchor,
      props: base as never,
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join("\n")).toMatch(/collapsible-content-no-aria-hidden[\s\S]*content/)
  })
})
